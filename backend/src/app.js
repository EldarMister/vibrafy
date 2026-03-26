import cors from "cors";
import express from "express";
import {
  countTracks,
} from "./repositories/tracksRepository.js";
import {
  getParserJobEvents,
  getParserSettings,
  getRecentParserJobs,
  updateParserSettings,
} from "./repositories/parserRepository.js";
import { countUsers, upsertTelegramUser } from "./repositories/usersRepository.js";
import {
  createManualTrack,
  listCatalogArtists,
  listCatalogGenres,
  listTracks,
  runManualParser,
  searchLibrary,
  startFullCatalogImport,
  stopFullCatalogImport,
  softDeleteTrack,
  updateTrack,
} from "./services/libraryService.js";

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY || "changeme";
  const headerKey = req.header("x-admin-key");

  if (headerKey !== adminKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/users/seen", async (req, res) => {
    const user = req.body?.user;

    if (!user?.id) {
      return res.json({ tracked: false });
    }

    const saved = await upsertTelegramUser(user);
    return res.json({ tracked: true, user: saved });
  });

  app.get("/search", async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        message: "Query parameter q is required",
      });
    }

    try {
      const tracks = await searchLibrary(query);
      return res.json(tracks);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown library error";

      return res.status(502).json({
        message: "Failed to get tracks",
        details: message,
      });
    }
  });

  app.use("/admin", requireAdmin);

  app.get("/admin/stats", async (_req, res) => {
    const [userCount, trackCount, parserSettings, jobs] = await Promise.all([
      countUsers(),
      countTracks(),
      getParserSettings(),
      getRecentParserJobs(5),
    ]);

    return res.json({
      users: userCount,
      tracks: trackCount,
      catalog: {
        artists: trackCount.artists,
        genres: trackCount.genres,
      },
      parser: parserSettings,
      recent_jobs: jobs,
    });
  });

  app.get("/admin/tracks", async (req, res) => {
    const search = String(req.query.search || "");
    const artist = String(req.query.artist || "");
    const genre = String(req.query.genre || "");
    const activeOnly =
      req.query.active === undefined ? undefined : req.query.active === "true";
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const tracks = await listTracks({
      search,
      artist,
      genre,
      isActive: activeOnly,
      limit,
      offset,
    });
    return res.json(tracks);
  });

  app.get("/admin/artists", async (req, res) => {
    const search = String(req.query.search || "");
    const limit = Math.min(Number(req.query.limit || 100), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const artists = await listCatalogArtists({ search, limit, offset });
    return res.json(artists);
  });

  app.get("/admin/genres", async (req, res) => {
    const search = String(req.query.search || "");
    const limit = Math.min(Number(req.query.limit || 100), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const genres = await listCatalogGenres({ search, limit, offset });
    return res.json(genres);
  });

  app.post("/admin/tracks", async (req, res) => {
    const {
      title,
      artist,
      audio_url: audioUrl,
      cover,
      is_active: isActive,
      catalog_artist_name: catalogArtistName,
      genre_name: genreName,
    } = req.body || {};

    if (!title || !artist || !audioUrl) {
      return res.status(400).json({
        message: "title, artist and audio_url are required",
      });
    }

    const track = await createManualTrack({
      title: String(title).trim(),
      artist: String(artist).trim(),
      audio_url: String(audioUrl).trim(),
      cover: cover ? String(cover).trim() : null,
      is_active: isActive === undefined ? true : Boolean(isActive),
      catalog_artist_name: catalogArtistName
        ? String(catalogArtistName).trim()
        : String(artist).trim(),
      genre_name: genreName ? String(genreName).trim() : "",
    });

    return res.status(201).json(track);
  });

  app.put("/admin/tracks/:id", async (req, res) => {
    const {
      title,
      artist,
      audio_url: audioUrl,
      cover,
      is_active: isActive,
      catalog_artist_name: catalogArtistName,
      genre_name: genreName,
    } =
      req.body || {};

    const track = await updateTrack(req.params.id, {
      title: String(title || "").trim(),
      artist: String(artist || "").trim(),
      audio_url: String(audioUrl || "").trim(),
      cover: cover ? String(cover).trim() : null,
      is_active: Boolean(isActive),
      catalog_artist_name: catalogArtistName
        ? String(catalogArtistName).trim()
        : "",
      genre_name: genreName ? String(genreName).trim() : "",
    });

    if (!track) {
      return res.status(404).json({ message: "Track not found" });
    }

    return res.json(track);
  });

  app.delete("/admin/tracks/:id", async (req, res) => {
    const track = await softDeleteTrack(req.params.id);

    if (!track) {
      return res.status(404).json({ message: "Track not found" });
    }

    return res.json({ success: true, track });
  });

  app.get("/admin/parser", async (_req, res) => {
    const [settings, jobs] = await Promise.all([
      getParserSettings(),
      getRecentParserJobs(10),
    ]);

    return res.json({ settings, jobs });
  });

  app.patch("/admin/parser", async (req, res) => {
    const payload = {
      enabled: req.body?.enabled,
      auto_import_on_search: req.body?.auto_import_on_search,
      hourly_limit:
        req.body?.hourly_limit === undefined
          ? undefined
          : Number(req.body.hourly_limit),
      request_delay_ms:
        req.body?.request_delay_ms === undefined
          ? undefined
          : Number(req.body.request_delay_ms),
      worker_concurrency:
        req.body?.worker_concurrency === undefined
          ? undefined
          : Number(req.body.worker_concurrency),
    };
    const settings = await updateParserSettings(payload);
    return res.json(settings);
  });

  app.get("/admin/parser/jobs/:id/events", async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const events = await getParserJobEvents(req.params.id, limit);
    return res.json(events);
  });

  app.post("/admin/parser/run", async (req, res) => {
    const query = String(req.body?.query || "").trim();

    if (!query) {
      return res.status(400).json({ message: "query is required" });
    }

    try {
      const result = await runManualParser(query);
      return res.json(result);
    } catch (error) {
      return res.status(502).json({
        message: "Parser run failed",
        details: error instanceof Error ? error.message : "Unknown parser error",
      });
    }
  });

  app.post("/admin/parser/catalog/start", async (_req, res) => {
    try {
      const job = await startFullCatalogImport();
      return res.status(202).json(job);
    } catch (error) {
      return res.status(409).json({
        message: error instanceof Error ? error.message : "Catalog parser start failed",
      });
    }
  });

  app.post("/admin/parser/catalog/stop", async (_req, res) => {
    const settings = await stopFullCatalogImport();
    return res.json({
      success: true,
      parser: settings,
    });
  });

  return app;
}
