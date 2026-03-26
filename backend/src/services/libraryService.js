import {
  createManualTrack,
  listCatalogArtists,
  listCatalogGenres,
  listTracks,
  searchTracksInDb,
  softDeleteTrack,
  updateTrack,
  upsertParsedTracks,
} from "../repositories/tracksRepository.js";
import {
  appendParserJobEvent,
  clearParserStopRequest,
  completeParserJob,
  createParserJob,
  failParserJob,
  getParserSettings,
  importTracksWithQuota,
  requestParserStop,
  updateParserJobProgress,
} from "../repositories/parserRepository.js";
import {
  discoverArtists,
  discoverGenres,
  fetchCatalogPage,
  fetchTracksFromSource,
} from "./sefonService.js";

const PAGE_LIMITS = {
  artist: 60,
  best: 30,
  generic: 30,
  genre: 50,
  news: 120,
  top: 40,
};

const DISCOVERY_SECTIONS = [
  { path: "/news/", section: "news", pageLimit: PAGE_LIMITS.news },
  { path: "/top/", section: "top", pageLimit: PAGE_LIMITS.top },
  { path: "/best/", section: "best", pageLimit: PAGE_LIMITS.best },
  { path: "/best/week/", section: "best_week", pageLimit: PAGE_LIMITS.generic },
  { path: "/best/month/", section: "best_month", pageLimit: PAGE_LIMITS.generic },
];

let activeCatalogRun = null;

function uniqueParsedTracks(tracks) {
  const map = new Map();

  for (const track of tracks) {
    if (!track?.source_track_id || map.has(track.source_track_id)) {
      continue;
    }

    map.set(track.source_track_id, track);
  }

  return [...map.values()];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotFoundError(error) {
  return error?.response?.status === 404;
}

function createArtistQueue(initialArtists = []) {
  const queue = [];
  const known = new Set();

  function addMany(artists) {
    let added = 0;

    for (const artist of artists) {
      if (!artist?.slug || known.has(artist.slug)) {
        continue;
      }

      known.add(artist.slug);
      queue.push(artist);
      added += 1;
    }

    return added;
  }

  addMany(initialArtists);

  return {
    addMany,
    next() {
      return queue.shift() || null;
    },
    get queued() {
      return queue.length;
    },
    get totalKnown() {
      return known.size;
    },
  };
}

async function applyRequestDelay() {
  const parserSettings = await getParserSettings();

  if (parserSettings.request_delay_ms > 0) {
    await sleep(parserSettings.request_delay_ms);
  }
}

async function shouldStopCatalogRun() {
  const parserSettings = await getParserSettings();
  return parserSettings.stop_requested;
}

async function importParsedTracks(parsedTracks) {
  return importTracksWithQuota({
    parsedTracks: uniqueParsedTracks(parsedTracks),
    importTracks: upsertParsedTracks,
  });
}

async function createTrackedParserRun({ query, triggerType, jobKind, fetchTracks }) {
  const job = await createParserJob({
    queryText: query,
    triggerType,
    jobKind,
  });

  try {
    await appendParserJobEvent(job.id, {
      level: "info",
      message: `Запущен парсер для запроса "${query}"`,
    });

    await applyRequestDelay();
    const parsedTracks = uniqueParsedTracks(await fetchTracks());
    const result = await importParsedTracks(parsedTracks);

    await updateParserJobProgress(job.id, {
      parsed_count: result.parsedCount,
      imported_count: result.importedCount,
      discovered_tracks: result.parsedCount,
      discovered_artists: 0,
      processed_pages: 1,
    });

    await appendParserJobEvent(job.id, {
      level: result.limitReached ? "warn" : "info",
      message: result.limitReached
        ? `Достигнут лимит. Импортировано ${result.importedCount} из ${result.parsedCount} треков`
        : `Импортировано ${result.importedCount} треков`,
      meta: {
        parsedCount: result.parsedCount,
        importedCount: result.importedCount,
        remainingHourlyQuota: result.remainingHourlyQuota,
      },
    });

    await completeParserJob(job.id, {
      status: result.limitReached ? "limit_reached" : "completed",
      parsed_count: result.parsedCount,
      imported_count: result.importedCount,
      discovered_tracks: result.parsedCount,
      processed_pages: 1,
    });

    return {
      ...result,
      jobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";

    await appendParserJobEvent(job.id, {
      level: "error",
      message,
    });
    await failParserJob(job.id, message);
    throw error;
  }
}

async function crawlPaginatedSection({
  path,
  section,
  pageLimit,
  artist = null,
  genre = null,
  queueArtists,
  counts,
  jobId,
}) {
  const seenPageSignatures = new Set();

  for (let page = 1; page <= pageLimit; page += 1) {
    if (await shouldStopCatalogRun()) {
      return { stopped: true, limitReached: false };
    }

    await applyRequestDelay();

    let pageData;
    try {
      pageData = await fetchCatalogPage(path, {
        page,
        section,
        artist,
        genre,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        break;
      }

      await appendParserJobEvent(jobId, {
        level: "warn",
        message: `Не удалось обработать ${section} page ${page}`,
        meta: {
          path,
          page,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      break;
    }

    const pageTracks = uniqueParsedTracks(pageData.tracks);

    if (!pageTracks.length) {
      break;
    }

    const pageSignature = pageTracks
      .map((track) => track.source_track_id)
      .join(",");

    if (seenPageSignatures.has(pageSignature)) {
      break;
    }

    seenPageSignatures.add(pageSignature);

    const addedArtists = queueArtists(pageData.artistLinks || []);
    const importResult = await importParsedTracks(pageTracks);

    counts.processedPages += 1;
    counts.parsedCount += importResult.parsedCount;
    counts.importedCount += importResult.importedCount;
    counts.discoveredTracks += pageTracks.length;
    counts.discoveredArtists += addedArtists;

    await updateParserJobProgress(jobId, {
      status: "running",
      parsed_count: counts.parsedCount,
      imported_count: counts.importedCount,
      discovered_tracks: counts.discoveredTracks,
      discovered_artists: counts.discoveredArtists,
      processed_pages: counts.processedPages,
    });

    await appendParserJobEvent(jobId, {
      level: importResult.limitReached ? "warn" : "info",
      message: `${section} page ${page}: parsed ${pageTracks.length}, imported ${importResult.importedCount}, artists +${addedArtists}`,
      meta: {
        path,
        page,
        pageUrl: pageData.pageUrl,
        remainingHourlyQuota: importResult.remainingHourlyQuota,
      },
    });

    if (importResult.limitReached) {
      return { stopped: false, limitReached: true };
    }
  }

  return { stopped: false, limitReached: false };
}

async function runArtistWorkers({ queue, counts, jobId }) {
  const parserSettings = await getParserSettings();
  const concurrency = Math.max(1, Math.min(parserSettings.worker_concurrency || 3, 8));
  let limitReached = false;
  let stopped = false;

  async function worker() {
    while (!limitReached && !stopped) {
      if (await shouldStopCatalogRun()) {
        stopped = true;
        return;
      }

      const artist = queue.next();

      if (!artist) {
        return;
      }

      await appendParserJobEvent(jobId, {
        level: "info",
        message: `Исполнитель: ${artist.name}`,
        meta: {
          artistSlug: artist.slug,
        },
      });

      const result = await crawlPaginatedSection({
        path: new URL(artist.url).pathname,
        section: "artist",
        pageLimit: PAGE_LIMITS.artist,
        artist,
        queueArtists: queue.addMany,
        counts,
        jobId,
      });

      limitReached = limitReached || result.limitReached;
      stopped = stopped || result.stopped;
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => worker()),
  );

  return { limitReached, stopped };
}

async function executeCatalogRun(jobId) {
  const parserSettings = await getParserSettings();

  if (!parserSettings.enabled) {
    await appendParserJobEvent(jobId, {
      level: "warn",
      message: "Полный обход отменен: парсер отключен",
    });
    await completeParserJob(jobId, { status: "disabled" });
    return;
  }

  await clearParserStopRequest();

  const counts = {
    discoveredArtists: 0,
    discoveredTracks: 0,
    importedCount: 0,
    parsedCount: 0,
    processedPages: 0,
  };

  await appendParserJobEvent(jobId, {
    level: "info",
    message: "Запущен полный обход Sefon по discoverable-разделам",
  });

  const initialArtists = await discoverArtists();
  const genres = await discoverGenres();
  const artistQueue = createArtistQueue(initialArtists);
  counts.discoveredArtists = artistQueue.totalKnown;

  await updateParserJobProgress(jobId, {
    status: "running",
    discovered_artists: counts.discoveredArtists,
  });

  await appendParserJobEvent(jobId, {
    level: "info",
    message: `Найдено ${genres.length} жанров и ${initialArtists.length} стартовых исполнителей`,
  });

  for (const section of DISCOVERY_SECTIONS) {
    const result = await crawlPaginatedSection({
      path: section.path,
      section: section.section,
      pageLimit: section.pageLimit,
      queueArtists: artistQueue.addMany,
      counts,
      jobId,
    });

    if (result.stopped || result.limitReached) {
      await completeParserJob(jobId, {
        status: result.stopped ? "stopped" : "limit_reached",
        parsed_count: counts.parsedCount,
        imported_count: counts.importedCount,
        discovered_tracks: counts.discoveredTracks,
        discovered_artists: counts.discoveredArtists,
        processed_pages: counts.processedPages,
      });
      return;
    }
  }

  for (const genre of genres) {
    const result = await crawlPaginatedSection({
      path: new URL(genre.url).pathname,
      section: "genre",
      pageLimit: PAGE_LIMITS.genre,
      genre,
      queueArtists: artistQueue.addMany,
      counts,
      jobId,
    });

    if (result.stopped || result.limitReached) {
      await completeParserJob(jobId, {
        status: result.stopped ? "stopped" : "limit_reached",
        parsed_count: counts.parsedCount,
        imported_count: counts.importedCount,
        discovered_tracks: counts.discoveredTracks,
        discovered_artists: counts.discoveredArtists,
        processed_pages: counts.processedPages,
      });
      return;
    }
  }

  const artistWorkerResult = await runArtistWorkers({
    queue: artistQueue,
    counts,
    jobId,
  });

  await completeParserJob(jobId, {
    status: artistWorkerResult.stopped
      ? "stopped"
      : artistWorkerResult.limitReached
        ? "limit_reached"
        : "completed",
    parsed_count: counts.parsedCount,
    imported_count: counts.importedCount,
    discovered_tracks: counts.discoveredTracks,
    discovered_artists: counts.discoveredArtists,
    processed_pages: counts.processedPages,
  });

  await appendParserJobEvent(jobId, {
    level: "info",
    message: `Обход завершен. Страниц: ${counts.processedPages}, найдено треков: ${counts.discoveredTracks}, импортировано: ${counts.importedCount}`,
  });
}

export async function searchLibrary(query) {
  const databaseTracks = await searchTracksInDb(query, 30);

  if (databaseTracks.length > 0) {
    return databaseTracks;
  }

  const parserSettings = await getParserSettings();

  if (!parserSettings.enabled || !parserSettings.auto_import_on_search) {
    return [];
  }

  await createTrackedParserRun({
    query,
    triggerType: "search",
    jobKind: "search",
    fetchTracks: () => fetchTracksFromSource(query),
  });

  return searchTracksInDb(query, 30);
}

export async function runManualParser(query) {
  const parserSettings = await getParserSettings();

  if (!parserSettings.enabled) {
    return {
      importedTracks: [],
      importedCount: 0,
      parsedCount: 0,
      limitReached: false,
      disabled: true,
    };
  }

  return createTrackedParserRun({
    query,
    triggerType: "manual",
    jobKind: "manual_search",
    fetchTracks: () => fetchTracksFromSource(query),
  });
}

export async function startFullCatalogImport() {
  if (activeCatalogRun) {
    throw new Error("Полный обход уже запущен");
  }

  const job = await createParserJob({
    queryText: "full-catalog",
    triggerType: "admin",
    jobKind: "catalog_full",
  });

  activeCatalogRun = executeCatalogRun(job.id)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : "Unknown parser error";
      await appendParserJobEvent(job.id, {
        level: "error",
        message,
      });
      await failParserJob(job.id, message);
    })
    .finally(async () => {
      activeCatalogRun = null;
      await clearParserStopRequest();
    });

  return job;
}

export async function stopFullCatalogImport() {
  return requestParserStop();
}

export {
  createManualTrack,
  listCatalogArtists,
  listCatalogGenres,
  listTracks,
  softDeleteTrack,
  updateTrack,
};
