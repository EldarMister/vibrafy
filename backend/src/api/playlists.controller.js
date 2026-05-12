import express from "express";
import {
  addTrackToPlaylist,
  createPlaylist,
  listPlaylists,
} from "../repositories/playlistRepository.js";

function getUserKey(req) {
  return String(
    req.header("x-user-key") ||
      req.body?.userKey ||
      req.query.userKey ||
      req.body?.telegramId ||
      "global",
  );
}

export function createPlaylistsRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const playlists = await listPlaylists(getUserKey(req));
    return res.json({ items: playlists });
  });

  router.post("/", async (req, res) => {
    const title = String(req.body?.title || "").trim();

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const playlist = await createPlaylist({
      userKey: getUserKey(req),
      title,
      description: req.body?.description ? String(req.body.description).trim() : "",
      coverUrl: req.body?.coverUrl ? String(req.body.coverUrl).trim() : null,
      type: req.body?.type ? String(req.body.type).trim() : "my",
      isSaved: Boolean(req.body?.isSaved),
    });

    return res.status(201).json(playlist);
  });

  router.post("/:id/tracks", async (req, res) => {
    const trackId = String(req.body?.trackId || req.body?.track_id || "").trim();

    if (!trackId) {
      return res.status(400).json({ message: "trackId is required" });
    }

    const playlist = await addTrackToPlaylist({
      playlistId: req.params.id,
      trackId,
      userKey: getUserKey(req),
    });

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    return res.json(playlist);
  });

  return router;
}
