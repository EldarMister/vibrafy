import { query } from "../db/pool.js";
import { normalizeTrackKey } from "../utils/normalizeTrack.js";

function safeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

export function mapTrack(row) {
  const coverUrl = row.cover_url || row.cover || row.catalog_artist_cover || null;
  const audioUrl = row.audio_url || null;
  const sourceUrl = row.source_url || row.source_page_url || null;
  const sourceId = row.source_id || row.source_track_id || null;
  const genre = row.genre_name || null;
  const mood = safeJsonArray(row.mood);
  const tags = safeJsonArray(row.tags);

  return {
    id: String(row.id),
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    coverUrl,
    audioUrl,
    sourceName: row.source_name,
    sourceUrl,
    sourceId,
    audioHash: row.audio_hash,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    genre,
    mood,
    tags,
    playCount: row.play_count || 0,
    isActive: row.is_active,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    errorMessage: row.error_message,

    // Backward-compatible fields used by the current frontend/admin.
    source_track_id: row.source_track_id,
    audio_url: audioUrl,
    cover: coverUrl,
    is_active: row.is_active,
    is_manual: row.is_manual,
    source_name: row.source_name,
    catalog_artist_name: row.catalog_artist_name,
    catalog_artist_slug: row.catalog_artist_slug,
    catalog_artist_link: row.catalog_artist_link,
    catalog_artist_cover: row.catalog_artist_cover,
    genre_name: row.genre_name,
    genre_slug: row.genre_slug,
    genre_link: row.genre_link,
    source_page_url: row.source_page_url,
    source_section: row.source_section,
    audio_source_url: row.audio_source_url,
    cover_source_url: row.cover_source_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildTrackWhere({ search = "", artist = "", genre = "", isActive, status }) {
  const values = [];
  const filters = [];

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    filters.push(
      `(
        LOWER(title) LIKE $${values.length}
        OR LOWER(artist) LIKE $${values.length}
        OR LOWER(COALESCE(album, '')) LIKE $${values.length}
        OR LOWER(COALESCE(catalog_artist_name, '')) LIKE $${values.length}
        OR LOWER(COALESCE(genre_name, '')) LIKE $${values.length}
        OR LOWER(COALESCE(tags::TEXT, '')) LIKE $${values.length}
        OR LOWER(title || ' ' || artist) LIKE $${values.length}
      )`,
    );
  }

  if (artist.trim()) {
    values.push(`%${artist.trim().toLowerCase()}%`);
    filters.push(`(LOWER(COALESCE(catalog_artist_name, artist)) LIKE $${values.length})`);
  }

  if (genre.trim()) {
    values.push(`%${genre.trim().toLowerCase()}%`);
    filters.push(`LOWER(COALESCE(genre_name, '')) LIKE $${values.length}`);
  }

  if (typeof isActive === "boolean") {
    values.push(isActive);
    filters.push(`is_active = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    values,
  };
}

export async function searchTracksInDb(search, limit = 30) {
  const normalized = `%${search.trim().toLowerCase()}%`;
  const result = await query(
    `
      SELECT *
      FROM tracks
      WHERE is_active = TRUE
        AND status = 'active'
        AND audio_url IS NOT NULL
        AND (
          LOWER(title) LIKE $1
          OR LOWER(artist) LIKE $1
          OR LOWER(COALESCE(album, '')) LIKE $1
          OR LOWER(COALESCE(catalog_artist_name, '')) LIKE $1
          OR LOWER(COALESCE(genre_name, '')) LIKE $1
          OR LOWER(COALESCE(tags::TEXT, '')) LIKE $1
          OR LOWER(title || ' ' || artist) LIKE $1
        )
      ORDER BY play_count DESC, updated_at DESC, id DESC
      LIMIT $2
    `,
    [normalized, limit],
  );

  return result.rows.map(mapTrack);
}

export async function listTracks({
  search = "",
  artist = "",
  genre = "",
  isActive,
  status,
  limit = 50,
  offset = 0,
}) {
  const { whereClause, values } = buildTrackWhere({
    search,
    artist,
    genre,
    isActive,
    status,
  });

  const countResult = await query(
    `
      SELECT COUNT(*)::INT AS total
      FROM tracks
      ${whereClause}
    `,
    values,
  );

  const rowsValues = [...values, limit, offset];
  const result = await query(
    `
      SELECT *
      FROM tracks
      ${whereClause}
      ORDER BY play_count DESC, updated_at DESC, id DESC
      LIMIT $${rowsValues.length - 1}
      OFFSET $${rowsValues.length}
    `,
    rowsValues,
  );

  return {
    total: countResult.rows[0]?.total || 0,
    items: result.rows.map(mapTrack),
  };
}

export async function getTrackById(id) {
  const result = await query(`SELECT * FROM tracks WHERE id = $1`, [id]);
  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function listCatalogArtists({ search = "", limit = 100, offset = 0 }) {
  const values = [];
  let whereClause = "WHERE is_active = TRUE AND status = 'active'";

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    whereClause += `
      AND LOWER(COALESCE(catalog_artist_name, artist)) LIKE $${values.length}
    `;
  }

  const countResult = await query(
    `
      SELECT COUNT(*)::INT AS total
      FROM (
        SELECT COALESCE(NULLIF(catalog_artist_name, ''), artist)
        FROM tracks
        ${whereClause}
        GROUP BY 1
      ) AS artist_groups
    `,
    values,
  );

  const listValues = [...values, limit, offset];
  const result = await query(
    `
      SELECT
        COALESCE(NULLIF(catalog_artist_name, ''), artist) AS name,
        COALESCE(
          NULLIF(catalog_artist_slug, ''),
          REGEXP_REPLACE(LOWER(COALESCE(NULLIF(catalog_artist_name, ''), artist)), '[^a-z0-9а-яё]+', '-', 'g')
        ) AS slug,
        MAX(catalog_artist_link) AS link,
        MAX(COALESCE(catalog_artist_cover, cover_url, cover)) AS cover,
        COUNT(*)::INT AS total_tracks,
        COUNT(*) FILTER (WHERE is_active = TRUE AND status = 'active')::INT AS active_tracks,
        MAX(updated_at) AS updated_at
      FROM tracks
      ${whereClause}
      GROUP BY 1, 2
      ORDER BY active_tracks DESC, updated_at DESC, name ASC
      LIMIT $${listValues.length - 1}
      OFFSET $${listValues.length}
    `,
    listValues,
  );

  return {
    total: countResult.rows[0]?.total || 0,
    items: result.rows,
  };
}

export async function listCatalogGenres({ search = "", limit = 100, offset = 0 }) {
  const values = [];
  let whereClause = `WHERE genre_name IS NOT NULL AND is_active = TRUE AND status = 'active'`;

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    whereClause += ` AND LOWER(genre_name) LIKE $${values.length}`;
  }

  const countResult = await query(
    `
      SELECT COUNT(*)::INT AS total
      FROM (
        SELECT genre_name
        FROM tracks
        ${whereClause}
        GROUP BY genre_name
      ) AS genre_groups
    `,
    values,
  );

  const listValues = [...values, limit, offset];
  const result = await query(
    `
      SELECT
        genre_name AS name,
        COALESCE(
          NULLIF(genre_slug, ''),
          REGEXP_REPLACE(LOWER(genre_name), '[^a-z0-9а-яё]+', '-', 'g')
        ) AS slug,
        MAX(genre_link) AS link,
        COUNT(*)::INT AS total_tracks,
        COUNT(*) FILTER (WHERE is_active = TRUE AND status = 'active')::INT AS active_tracks,
        MAX(updated_at) AS updated_at
      FROM tracks
      ${whereClause}
      GROUP BY 1, 2
      ORDER BY active_tracks DESC, updated_at DESC, name ASC
      LIMIT $${listValues.length - 1}
      OFFSET $${listValues.length}
    `,
    listValues,
  );

  return {
    total: countResult.rows[0]?.total || 0,
    items: result.rows,
  };
}

export async function createManualTrack(track) {
  const normalizedTitle = normalizeTrackKey(track.title);
  const normalizedArtist = normalizeTrackKey(track.artist);
  const result = await query(
    `
      INSERT INTO tracks (
        title,
        artist,
        album,
        duration,
        audio_url,
        cover,
        cover_url,
        is_active,
        is_manual,
        source_name,
        source_url,
        audio_source_url,
        cover_source_url,
        catalog_artist_name,
        catalog_artist_cover,
        genre_name,
        source_section,
        status,
        normalized_title,
        normalized_artist
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $6, $7, TRUE, 'manual',
        $5, $5, $6, $8, $9, $10, 'manual', $11, $12, $13
      )
      RETURNING *
    `,
    [
      track.title,
      track.artist,
      track.album || null,
      track.duration || null,
      track.audio_url,
      track.cover || null,
      track.is_active ?? true,
      track.catalog_artist_name || track.artist,
      track.catalog_artist_cover || null,
      track.genre_name || null,
      track.is_active === false ? "disabled" : "active",
      normalizedTitle,
      normalizedArtist,
    ],
  );

  return mapTrack(result.rows[0]);
}

export async function updateTrack(id, track) {
  const normalizedTitle = normalizeTrackKey(track.title);
  const normalizedArtist = normalizeTrackKey(track.artist);
  const result = await query(
    `
      UPDATE tracks
      SET
        title = $2,
        artist = $3,
        album = NULLIF($4, ''),
        duration = $5,
        audio_url = NULLIF($6, ''),
        cover = NULLIF($7, ''),
        cover_url = NULLIF($7, ''),
        is_active = $8,
        status = CASE WHEN $8 = TRUE THEN 'active' ELSE 'disabled' END,
        catalog_artist_name = COALESCE(NULLIF($9, ''), $3),
        catalog_artist_cover = NULLIF($10, ''),
        genre_name = NULLIF($11, ''),
        normalized_title = $12,
        normalized_artist = $13,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      track.title,
      track.artist,
      track.album || "",
      track.duration || null,
      track.audio_url,
      track.cover || "",
      track.is_active,
      track.catalog_artist_name || "",
      track.catalog_artist_cover || "",
      track.genre_name || "",
      normalizedTitle,
      normalizedArtist,
    ],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function softDeleteTrack(id) {
  const result = await query(
    `
      UPDATE tracks
      SET is_active = FALSE, status = 'disabled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function findDuplicateTrack(db, track) {
  const executor = db || { query };
  const result = await executor.query(
    `
      SELECT *
      FROM tracks
      WHERE
        ($1::TEXT IS NOT NULL AND source_name = $2 AND source_url = $1)
        OR ($3::TEXT IS NOT NULL AND source_name = $2 AND source_id = $3)
        OR ($4::TEXT IS NOT NULL AND audio_hash = $4)
        OR (
          $5::TEXT IS NOT NULL
          AND $6::TEXT IS NOT NULL
          AND normalized_title = $5
          AND normalized_artist = $6
        )
      ORDER BY
        CASE
          WHEN $3::TEXT IS NOT NULL AND source_id = $3 THEN 1
          WHEN $1::TEXT IS NOT NULL AND source_url = $1 THEN 2
          WHEN $4::TEXT IS NOT NULL AND audio_hash = $4 THEN 3
          ELSE 4
        END,
        updated_at DESC
      LIMIT 1
    `,
    [
      track.source_url || null,
      track.source_name || "sefon",
      track.source_id || null,
      track.audio_hash || null,
      track.normalized_title || null,
      track.normalized_artist || null,
    ],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function createProcessingTrack(db, track) {
  const executor = db || { query };
  const result = await executor.query(
    `
      INSERT INTO tracks (
        source_track_id,
        title,
        artist,
        album,
        duration,
        audio_url,
        cover,
        cover_url,
        source_name,
        source_url,
        source_id,
        audio_source_url,
        cover_source_url,
        is_active,
        is_manual,
        catalog_artist_name,
        catalog_artist_slug,
        catalog_artist_link,
        catalog_artist_cover,
        genre_name,
        genre_slug,
        genre_link,
        source_page_url,
        source_section,
        mood,
        tags,
        status,
        normalized_title,
        normalized_artist
      )
      VALUES (
        $1, $2, $3, $4, $5, NULL, $6, $6, $7, $8, $9, $10, $11,
        FALSE, FALSE, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21::JSONB, $22::JSONB, 'processing', $23, $24
      )
      RETURNING *
    `,
    [
      track.source_track_id || track.source_id || null,
      track.title,
      track.artist,
      track.album || null,
      track.duration || null,
      track.cover_source_url || null,
      track.source_name || "sefon",
      track.source_url || null,
      track.source_id || null,
      track.audio_source_url || null,
      track.cover_source_url || null,
      track.catalog_artist_name || track.artist,
      track.catalog_artist_slug || null,
      track.catalog_artist_link || null,
      track.catalog_artist_cover || track.cover_source_url || null,
      track.genre_name || null,
      track.genre_slug || null,
      track.genre_link || null,
      track.source_page_url || null,
      track.source_section || null,
      JSON.stringify(track.mood || []),
      JSON.stringify(track.tags || []),
      track.normalized_title,
      track.normalized_artist,
    ],
  );

  return mapTrack(result.rows[0]);
}

export async function updateTrackMetadata(db, id, track, { markProcessing = false } = {}) {
  const executor = db || { query };
  const result = await executor.query(
    `
      UPDATE tracks
      SET
        title = $2,
        artist = $3,
        album = COALESCE($4, album),
        duration = COALESCE($5, duration),
        cover = COALESCE(NULLIF($6, ''), cover),
        cover_url = COALESCE(NULLIF($6, ''), cover_url),
        source_url = COALESCE(NULLIF($7, ''), source_url),
        source_id = COALESCE(NULLIF($8, ''), source_id),
        audio_source_url = COALESCE(NULLIF($9, ''), audio_source_url),
        cover_source_url = COALESCE(NULLIF($10, ''), cover_source_url),
        catalog_artist_name = COALESCE(NULLIF($11, ''), catalog_artist_name, $3),
        catalog_artist_slug = COALESCE(NULLIF($12, ''), catalog_artist_slug),
        catalog_artist_link = COALESCE(NULLIF($13, ''), catalog_artist_link),
        catalog_artist_cover = COALESCE(NULLIF($14, ''), catalog_artist_cover),
        genre_name = COALESCE(NULLIF($15, ''), genre_name),
        genre_slug = COALESCE(NULLIF($16, ''), genre_slug),
        genre_link = COALESCE(NULLIF($17, ''), genre_link),
        source_page_url = COALESCE(NULLIF($18, ''), source_page_url),
        source_section = COALESCE(NULLIF($19, ''), source_section),
        mood = CASE WHEN $20::JSONB = '[]'::JSONB THEN mood ELSE $20::JSONB END,
        tags = CASE WHEN $21::JSONB = '[]'::JSONB THEN tags ELSE $21::JSONB END,
        normalized_title = $22,
        normalized_artist = $23,
        status = CASE WHEN $24 = TRUE THEN 'processing' ELSE status END,
        error_message = CASE WHEN $24 = TRUE THEN NULL ELSE error_message END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      track.title,
      track.artist,
      track.album || null,
      track.duration || null,
      track.cover_source_url || track.cover || "",
      track.source_url || "",
      track.source_id || "",
      track.audio_source_url || "",
      track.cover_source_url || "",
      track.catalog_artist_name || "",
      track.catalog_artist_slug || "",
      track.catalog_artist_link || "",
      track.catalog_artist_cover || "",
      track.genre_name || "",
      track.genre_slug || "",
      track.genre_link || "",
      track.source_page_url || "",
      track.source_section || "",
      JSON.stringify(track.mood || []),
      JSON.stringify(track.tags || []),
      track.normalized_title,
      track.normalized_artist,
      markProcessing,
    ],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function activateStoredTrack(db, id, payload) {
  const executor = db || { query };
  const result = await executor.query(
    `
      UPDATE tracks
      SET
        audio_url = $2,
        cover = COALESCE($3, cover),
        cover_url = COALESCE($3, cover_url),
        audio_hash = COALESCE($4, audio_hash),
        file_size = COALESCE($5, file_size),
        audio_storage_path = COALESCE($6, audio_storage_path),
        cover_storage_path = COALESCE($7, cover_storage_path),
        storage_provider = $8,
        status = 'active',
        is_active = TRUE,
        error_message = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.audioUrl,
      payload.coverUrl || null,
      payload.audioHash || null,
      payload.fileSize || null,
      payload.audioStoragePath || null,
      payload.coverStoragePath || null,
      payload.storageProvider || "local",
    ],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function markTrackFailed(db, id, errorMessage) {
  const executor = db || { query };
  const result = await executor.query(
    `
      UPDATE tracks
      SET
        status = 'failed',
        is_active = FALSE,
        error_message = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, errorMessage],
  );

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function incrementTrackPlayCount(id, userKey = "anonymous") {
  const result = await query(
    `
      UPDATE tracks
      SET play_count = play_count + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'active' AND is_active = TRUE
      RETURNING *
    `,
    [id],
  );

  if (result.rows[0]) {
    await query(
      `
        INSERT INTO listening_history (user_key, track_id)
        VALUES ($1, $2)
      `,
      [userKey, id],
    );
  }

  return result.rows[0] ? mapTrack(result.rows[0]) : null;
}

export async function toggleTrackLike(id, userKey = "anonymous") {
  const existing = await query(
    `
      SELECT 1
      FROM track_likes
      WHERE user_key = $1 AND track_id = $2
    `,
    [userKey, id],
  );

  if (existing.rows.length) {
    await query(
      `
        DELETE FROM track_likes
        WHERE user_key = $1 AND track_id = $2
      `,
      [userKey, id],
    );

    return { liked: false };
  }

  await query(
    `
      INSERT INTO track_likes (user_key, track_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [userKey, id],
  );

  return { liked: true };
}

export async function countTracks() {
  const result = await query(
    `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE is_active = TRUE AND status = 'active')::INT AS active,
        COUNT(DISTINCT COALESCE(NULLIF(catalog_artist_name, ''), artist))::INT AS artists,
        COUNT(DISTINCT genre_name)::INT AS genres
      FROM tracks
    `,
  );

  return result.rows[0];
}
