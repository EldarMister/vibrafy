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
    catalog_artist_name: row.catalog_artist_name,
    catalog_artist_slug: row.catalog_artist_slug,
    catalog_artist_link: row.catalog_artist_link,
    genre_name: row.genre_name,
    genre_slug: row.genre_slug,
    genre_link: row.genre_link,
    source_page_url: row.source_page_url,
    source_section: row.source_section,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildTrackWhere({ search = "", artist = "", genre = "", isActive }) {
  const values = [];
  const filters = [];

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    filters.push(
      `(
        LOWER(title) LIKE $${values.length}
        OR LOWER(artist) LIKE $${values.length}
        OR LOWER(COALESCE(catalog_artist_name, '')) LIKE $${values.length}
        OR LOWER(COALESCE(genre_name, '')) LIKE $${values.length}
      )`,
    );
  }

  if (artist.trim()) {
    values.push(`%${artist.trim().toLowerCase()}%`);
    filters.push(
      `(LOWER(COALESCE(catalog_artist_name, artist)) LIKE $${values.length})`,
    );
  }

  if (genre.trim()) {
    values.push(`%${genre.trim().toLowerCase()}%`);
    filters.push(`LOWER(COALESCE(genre_name, '')) LIKE $${values.length}`);
  }

  if (typeof isActive === "boolean") {
    values.push(isActive);
    filters.push(`is_active = $${values.length}`);
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
        AND (
          LOWER(title) LIKE $1
          OR LOWER(artist) LIKE $1
          OR LOWER(COALESCE(catalog_artist_name, '')) LIKE $1
          OR LOWER(COALESCE(genre_name, '')) LIKE $1
          OR LOWER(title || ' ' || artist) LIKE $1
        )
      ORDER BY updated_at DESC, id DESC
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
  limit = 50,
  offset = 0,
}) {
  const { whereClause, values } = buildTrackWhere({
    search,
    artist,
    genre,
    isActive,
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
      ORDER BY updated_at DESC, id DESC
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

export async function listCatalogArtists({ search = "", limit = 100, offset = 0 }) {
  const values = [];
  let whereClause = "";

  if (search.trim()) {
    values.push(`%${search.trim().toLowerCase()}%`);
    whereClause = `
      WHERE LOWER(COALESCE(catalog_artist_name, artist)) LIKE $${values.length}
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
        COUNT(*)::INT AS total_tracks,
        COUNT(*) FILTER (WHERE is_active = TRUE)::INT AS active_tracks,
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
  let whereClause = `WHERE genre_name IS NOT NULL`;

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
        COUNT(*) FILTER (WHERE is_active = TRUE)::INT AS active_tracks,
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
  const result = await query(
    `
      INSERT INTO tracks (
        title,
        artist,
        audio_url,
        cover,
        is_active,
        is_manual,
        source_name,
        catalog_artist_name
      )
      VALUES ($1, $2, $3, $4, TRUE, TRUE, 'manual', $2)
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
        catalog_artist_name = COALESCE(NULLIF($7, ''), catalog_artist_name, $3),
        genre_name = NULLIF($8, ''),
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
      track.catalog_artist_name || "",
      track.genre_name || "",
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
          is_manual,
          catalog_artist_name,
          catalog_artist_slug,
          catalog_artist_link,
          genre_name,
          genre_slug,
          genre_link,
          source_page_url,
          source_section
        )
        VALUES (
          $1, $2, $3, $4, $5, 'sefon', TRUE, FALSE,
          $6, $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (source_track_id) DO UPDATE
        SET
          title = EXCLUDED.title,
          artist = EXCLUDED.artist,
          audio_url = EXCLUDED.audio_url,
          cover = EXCLUDED.cover,
          is_active = TRUE,
          catalog_artist_name = COALESCE(EXCLUDED.catalog_artist_name, tracks.catalog_artist_name),
          catalog_artist_slug = COALESCE(EXCLUDED.catalog_artist_slug, tracks.catalog_artist_slug),
          catalog_artist_link = COALESCE(EXCLUDED.catalog_artist_link, tracks.catalog_artist_link),
          genre_name = COALESCE(EXCLUDED.genre_name, tracks.genre_name),
          genre_slug = COALESCE(EXCLUDED.genre_slug, tracks.genre_slug),
          genre_link = COALESCE(EXCLUDED.genre_link, tracks.genre_link),
          source_page_url = COALESCE(EXCLUDED.source_page_url, tracks.source_page_url),
          source_section = COALESCE(EXCLUDED.source_section, tracks.source_section),
          updated_at = NOW()
        RETURNING *
      `,
      [
        track.source_track_id,
        track.title,
        track.artist,
        track.audio_url,
        track.cover || null,
        track.catalog_artist_name || null,
        track.catalog_artist_slug || null,
        track.catalog_artist_link || null,
        track.genre_name || null,
        track.genre_slug || null,
        track.genre_link || null,
        track.source_page_url || null,
        track.source_section || null,
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
        COUNT(*) FILTER (WHERE is_active = TRUE)::INT AS active,
        COUNT(DISTINCT COALESCE(NULLIF(catalog_artist_name, ''), artist))::INT AS artists,
        COUNT(DISTINCT genre_name)::INT AS genres
      FROM tracks
    `,
  );

  return result.rows[0];
}
