import {
  createManualTrack,
  listTracks,
  searchTracksInDb,
  softDeleteTrack,
  updateTrack,
  upsertParsedTracks,
} from "../repositories/tracksRepository.js";
import {
  getParserSettings,
  importTracksWithLimit,
  recordParserFailure,
} from "../repositories/parserRepository.js";
import { fetchTracksFromSource } from "./sefonService.js";

function uniqueParsedTracks(tracks) {
  const map = new Map();

  for (const track of tracks) {
    if (!track.source_track_id || map.has(track.source_track_id)) {
      continue;
    }

    map.set(track.source_track_id, track);
  }

  return [...map.values()];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  try {
    if (parserSettings.request_delay_ms > 0) {
      await sleep(parserSettings.request_delay_ms);
    }

    const parsedTracks = uniqueParsedTracks(await fetchTracksFromSource(query));
    await importTracksWithLimit({
      queryText: query,
      triggerType: "search",
      parsedTracks,
      importTracks: upsertParsedTracks,
    });

    return searchTracksInDb(query, 30);
  } catch (error) {
    await recordParserFailure({
      queryText: query,
      triggerType: "search",
      errorMessage: error instanceof Error ? error.message : "Unknown parser error",
    });
    throw error;
  }
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

  try {
    if (parserSettings.request_delay_ms > 0) {
      await sleep(parserSettings.request_delay_ms);
    }

    const parsedTracks = uniqueParsedTracks(await fetchTracksFromSource(query));
    return importTracksWithLimit({
      queryText: query,
      triggerType: "manual",
      parsedTracks,
      importTracks: upsertParsedTracks,
    });
  } catch (error) {
    await recordParserFailure({
      queryText: query,
      triggerType: "manual",
      errorMessage: error instanceof Error ? error.message : "Unknown parser error",
    });
    throw error;
  }
}

export { createManualTrack, listTracks, softDeleteTrack, updateTrack };

