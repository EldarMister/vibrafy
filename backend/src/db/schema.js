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
      ADD COLUMN IF NOT EXISTS genre_name TEXT,
      ADD COLUMN IF NOT EXISTS genre_slug TEXT,
      ADD COLUMN IF NOT EXISTS genre_link TEXT,
      ADD COLUMN IF NOT EXISTS source_page_url TEXT,
      ADD COLUMN IF NOT EXISTS source_section TEXT;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_active_title_artist
    ON tracks (is_active, title, artist);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_catalog_artist
    ON tracks (catalog_artist_slug, catalog_artist_name);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tracks_genre
    ON tracks (genre_slug, genre_name);
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
  await ensureParserSettingsTable();
  await ensureParserJobsTable();
  await ensureParserJobEventsTable();
}
