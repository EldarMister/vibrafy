import { query } from "./pool.js";

export async function ensureSchema() {
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
    CREATE INDEX IF NOT EXISTS idx_tracks_active_title_artist
    ON tracks (is_active, title, artist);
  `);

  await query(`
    INSERT INTO parser_settings (
      id,
      enabled,
      auto_import_on_search,
      hourly_limit,
      request_delay_ms
    )
    VALUES (1, TRUE, TRUE, 1000, 0)
    ON CONFLICT (id) DO NOTHING;
  `);
}

