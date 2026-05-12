import { query } from "../db/pool.js";

function mapPlaylist(row) {
  const trackIds = Array.isArray(row.track_ids) ? row.track_ids.map(String) : [];

  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    trackIds,
    type: row.type,
    isSaved: row.is_saved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Backward-compatible frontend shape.
    cover: row.cover_url,
    tracks: trackIds,
    is_saved: row.is_saved,
  };
}

export async function listPlaylists(userKey = "global") {
  const result = await query(
    `
      SELECT
        p.*,
        COALESCE(
          JSON_AGG(pt.track_id ORDER BY pt.position, pt.created_at)
            FILTER (WHERE pt.track_id IS NOT NULL),
          '[]'::JSON
        ) AS track_ids
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.user_key = $1 OR p.user_key = 'global'
      GROUP BY p.id
      ORDER BY p.updated_at DESC, p.id DESC
    `,
    [userKey],
  );

  return result.rows.map(mapPlaylist);
}

export async function createPlaylist({
  userKey = "global",
  title,
  description = "",
  coverUrl = null,
  type = "my",
  isSaved = false,
}) {
  const result = await query(
    `
      INSERT INTO playlists (user_key, title, description, cover_url, type, is_saved)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *, '[]'::JSON AS track_ids
    `,
    [userKey, title, description, coverUrl, type, isSaved],
  );

  return mapPlaylist(result.rows[0]);
}

export async function addTrackToPlaylist({ playlistId, trackId, userKey = "global" }) {
  const playlist = await query(
    `
      SELECT id
      FROM playlists
      WHERE id = $1 AND (user_key = $2 OR user_key = 'global')
    `,
    [playlistId, userKey],
  );

  if (!playlist.rows.length) {
    return null;
  }

  const positionResult = await query(
    `
      SELECT COALESCE(MAX(position), 0) + 1 AS next_position
      FROM playlist_tracks
      WHERE playlist_id = $1
    `,
    [playlistId],
  );

  await query(
    `
      INSERT INTO playlist_tracks (playlist_id, track_id, position)
      VALUES ($1, $2, $3)
      ON CONFLICT (playlist_id, track_id) DO NOTHING
    `,
    [playlistId, trackId, positionResult.rows[0]?.next_position || 1],
  );

  await query(
    `
      UPDATE playlists
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [playlistId],
  );

  const result = await query(
    `
      SELECT
        p.*,
        COALESCE(
          JSON_AGG(pt.track_id ORDER BY pt.position, pt.created_at)
            FILTER (WHERE pt.track_id IS NOT NULL),
          '[]'::JSON
        ) AS track_ids
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `,
    [playlistId],
  );

  return result.rows[0] ? mapPlaylist(result.rows[0]) : null;
}
