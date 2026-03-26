import { query } from "../db/pool.js";

function mapTrack(row) {
  return {
    id: String(row.id),
    source_track_id: row.source_track_id,
    title: row.title,
    artist: row.artist,
    audio_url: row.audio_url,
    cover: row.cover,
    is_active: row.is_active,
    is_manual: row.is_manual,
    source_name: row.source_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function searchTracksInDb(search, limit = 30) {
  const normalized = `%${search.trim().toLowerCase()}%`;
  const result = await query(
    `
      SELECT *
      FROM tracks
      WHERE is_active = TRUE
        AND (
          LOWER(title) LIKE $1
          OR LOWER(artist) LIKE $1
          OR LOWER(title || ' ' || artist) LIKE $1
        )
      ORDER BY updated_at DESC, id DESC
      LIMIT $2
    `,
    [normalized, limit],
  );

  return result.rows.map(mapTrack);
}

export async function listTracks({ search = "", limit = 50, offset = 0 }) {
  const values = [];
  const filters = [];

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    filters.push(
      `(LOWER(title) LIKE $${values.length} OR LOWER(artist) LIKE $${values.length})`,
    );
  }

  values.push(limit);
  values.push(offset);

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await query(
    `
      SELECT *
      FROM tracks
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return result.rows.map(mapTrack);
}

export async function createManualTrack(track) {
  const result = await query(
    `
      INSERT INTO tracks (
        title,
        artist,
        audio_url,
        cover,
        is_active,
        is_manual,
        source_name
      )
      VALUES ($1, $2, $3, $4, TRUE, TRUE, 'manual')
      RETURNING *
    `,
    [track.title, track.artist, track.audio_url, track.cover || null],
  );

  return mapTrack(result.rows[0]);
}

export async function updateTrack(id, track) {
  const result = await query(
    `
      UPDATE tracks
      SET
        title = $2,
        artist = $3,
        audio_url = $4,
        cover = $5,
        is_active = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      track.title,
      track.artist,
      track.audio_url,
      track.cover || null,
      track.is_active,
    ],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function softDeleteTrack(id) {
  const result = await query(
    `
      UPDATE tracks
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function upsertParsedTracks(client, tracks) {
  const imported = [];

  for (const track of tracks) {
    const result = await client.query(
      `
        INSERT INTO tracks (
          source_track_id,
          title,
          artist,
          audio_url,
          cover,
          source_name,
          is_active,
          is_manual
        )
        VALUES ($1, $2, $3, $4, $5, 'sefon', TRUE, FALSE)
        ON CONFLICT (source_track_id) DO UPDATE
        SET
          title = EXCLUDED.title,
          artist = EXCLUDED.artist,
          audio_url = EXCLUDED.audio_url,
          cover = EXCLUDED.cover,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING *
      `,
      [
        track.source_track_id,
        track.title,
        track.artist,
        track.audio_url,
        track.cover || null,
      ],
    );

    imported.push(mapTrack(result.rows[0]));
  }

  return imported;
}

export async function countTracks() {
  const result = await query(
    `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE is_active = TRUE)::INT AS active
      FROM tracks
    `,
  );

  return result.rows[0];
}

