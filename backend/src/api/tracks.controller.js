import express from "express";
import {
  getTrackById,
  incrementTrackPlayCount,
  listTracks,
  searchTracksInDb,
  toggleTrackLike,
} from "../repositories/tracksRepository.js";

function getUserKey(req) {
  return String(
    req.header("x-user-key") ||
      req.body?.userKey ||
      req.query.userKey ||
      req.body?.telegramId ||
      "anonymous",
  );
}

export function createTracksRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const search = String(req.query.search || req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 1000);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    if (search) {
      const items = await searchTracksInDb(search, limit);
      return res.json({
        total: items.length,
        items,
      });
    }

    const tracks = await listTracks({
      isActive: true,
      status: "active",
      limit,
      offset,
    });

    return res.json(tracks);
  });

  router.get("/:id", async (req, res) => {
    const track = await getTrackById(req.params.id);

    if (!track || !track.isActive || track.status !== "active") {
      return res.status(404).json({ message: "Track not found" });
    }

    return res.json(track);
  });

  router.post("/:id/like", async (req, res) => {
    const result = await toggleTrackLike(req.params.id, getUserKey(req));
    return res.json(result);
  });

  router.post("/:id/play", async (req, res) => {
    const track = await incrementTrackPlayCount(req.params.id, getUserKey(req));

    if (!track) {
      return res.status(404).json({ message: "Track not found" });
    }

    return res.json(track);
  });

  return router;
}
