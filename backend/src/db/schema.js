import { query } from "./pool.js";

async function ensureTracksTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id BIGSERIAL PRIMARY KEY,
      source_track_id TEXT UNIQUE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      cover TEXT,
      source_name TEXT NOT NULL DEFAULT 'sefon',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_manual BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS catalog_artist_name TEXT,
      ADD COLUMN IF NOT EXISTS catalog_artist_slug TEXT,
      ADD COLUMN IF NOT EXISTS catalog_artist_link TEXT,
      ADD COLUMN IF NOT EXISTS catalog_artist_cover TEXT,
      ADD COLUMN IF NOT EXISTS genre_name TEXT,
      ADD COLUMN IF NOT EXISTS genre_slug TEXT,
      ADD COLUMN IF NOT EXISTS genre_link TEXT,
      ADD COLUMN IF NOT EXISTS source_page_url TEXT,
      ADD COLUMN IF NOT EXISTS source_section TEXT,
      ADD COLUMN IF NOT EXISTS album TEXT,
      ADD COLUMN IF NOT EXISTS duration INTEGER,
      ADD COLUMN IF NOT EXISTS cover_url TEXT,
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS source_id TEXT,
      ADD COLUMN IF NOT EXISTS audio_source_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_source_url TEXT,
      ADD COLUMN IF NOT EXISTS audio_hash TEXT,
      ADD COLUMN IF NOT EXISTS file_size BIGINT,
      ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
      ADD COLUMN IF NOT EXISTS cover_storage_path TEXT,
      ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'local',
      ADD COLUMN IF NOT EXISTS mood JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS normalized_title TEXT,
      ADD COLUMN IF NOT EXISTS normalized_artist TEXT;
  `);

  await query(`
    ALTER TABLE tracks
      ALTER COLUMN audio_url DROP NOT NULL;
  `);

  await query(`
    UPDATE tracks
    SET
      cover_url = COALESCE(cover_url, cover, catalog_artist_cover),
      source_url = COALESCE(source_url, source_page_url, audio_url),
      source_id = COALESCE(source_id, source_track_id),
      audio_source_url = COALESCE(audio_source_url, audio_url),
      cover_source_url = COALESCE(cover_source_url, cover, catalog_artist_cover),
      normalized_title = COALESCE(
        normalized_title,
        REGEXP_REPLACE(LOWER(title), '[^a-z0-9а-яё]+', '', 'g')
      ),
      normalized_artist = COALESCE(
        normalized_artist,
        REGEXP_REPLACE(LOWER(artist), '[^a-z0-9а-яё]+', '', 'g')
      ),
      status = CASE
        WHEN is_active = FALSE THEN 'disabled'
        WHEN status IS NULL THEN 'active'
        ELSE status
      END
    WHERE TRUE;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_active_title_artist
    ON tracks (is_active, status, title, artist);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_catalog_artist
    ON tracks (catalog_artist_slug, catalog_artist_name);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_genre
    ON tracks (genre_slug, genre_name);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_source_lookup
    ON tracks (source_name, source_id, source_url);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_audio_hash
    ON tracks (audio_hash);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_normalized_lookup
    ON tracks (normalized_title, normalized_artist);
  `);
}

async function ensurePlaylistsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id BIGSERIAL PRIMARY KEY,
      user_key TEXT NOT NULL DEFAULT 'global',
      title TEXT NOT NULL,
      description TEXT,
      cover_url TEXT,
      type TEXT NOT NULL DEFAULT 'my',
      is_saved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (playlist_id, track_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_playlists_user_key
    ON playlists (user_key, updated_at DESC);
  `);
}

async function ensureTrackInteractionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS track_likes (
      user_key TEXT NOT NULL,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_key, track_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS listening_history (
      id BIGSERIAL PRIMARY KEY,
      user_key TEXT NOT NULL,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_listening_history_user_key
    ON listening_history (user_key, played_at DESC);
  `);
}

async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS telegram_users (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureParserSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS parser_settings (
      id INTEGER PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      auto_import_on_search BOOLEAN NOT NULL DEFAULT TRUE,
      hourly_limit INTEGER NOT NULL DEFAULT 1000,
      request_delay_ms INTEGER NOT NULL DEFAULT 0,
      items_processed_this_hour INTEGER NOT NULL DEFAULT 0,
      hour_window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE parser_settings
      ADD COLUMN IF NOT EXISTS worker_concurrency INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS stop_requested BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    INSERT INTO parser_settings (
      id,
      enabled,
      auto_import_on_search,
      hourly_limit,
      request_delay_ms,
      worker_concurrency,
      stop_requested
    )
    VALUES (1, TRUE, TRUE, 1000, 0, 3, FALSE)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function ensureParserJobsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS parser_jobs (
      id BIGSERIAL PRIMARY KEY,
      query TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      parsed_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );
  `);

  await query(`
    ALTER TABLE parser_jobs
      ADD COLUMN IF NOT EXISTS job_kind TEXT NOT NULL DEFAULT 'search',
      ADD COLUMN IF NOT EXISTS processed_pages INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discovered_artists INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discovered_tracks INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_parser_jobs_created_at
    ON parser_jobs (created_at DESC);
  `);
}

async function ensureParserJobEventsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS parser_job_events (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES parser_jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_parser_job_events_job_id
    ON parser_job_events (job_id, created_at DESC);
  `);
}

export async function ensureSchema() {
  await ensureTracksTable();
  await ensureUsersTable();
  await ensurePlaylistsTable();
  await ensureTrackInteractionsTable();
  await ensureParserSettingsTable();
  await ensureParserJobsTable();
  await ensureParserJobEventsTable();
}
