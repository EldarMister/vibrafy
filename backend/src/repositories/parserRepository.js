import { pool, query } from "../db/pool.js";

function mapSettings(row) {
  return {
    enabled: row.enabled,
    auto_import_on_search: row.auto_import_on_search,
    hourly_limit: row.hourly_limit,
    request_delay_ms: row.request_delay_ms,
    items_processed_this_hour: row.items_processed_this_hour,
    hour_window_started_at: row.hour_window_started_at,
    worker_concurrency: row.worker_concurrency,
    stop_requested: row.stop_requested,
    updated_at: row.updated_at,
  };
}

function mapJob(row) {
  return {
    id: String(row.id),
    query: row.query,
    trigger_type: row.trigger_type,
    job_kind: row.job_kind,
    status: row.status,
    parsed_count: row.parsed_count,
    imported_count: row.imported_count,
    discovered_tracks: row.discovered_tracks,
    discovered_artists: row.discovered_artists,
    processed_pages: row.processed_pages,
    error_message: row.error_message,
    created_at: row.created_at,
    finished_at: row.finished_at,
  };
}

function normalizeSettingsWindow(settingsRow) {
  const now = new Date();
  const hourWindowStartedAt = new Date(settingsRow.hour_window_started_at);
  const expired = now.getTime() - hourWindowStartedAt.getTime() >= 60 * 60 * 1000;

  return {
    now,
    hourWindowStartedAt: expired ? now : hourWindowStartedAt,
    itemsProcessedThisHour: expired ? 0 : settingsRow.items_processed_this_hour,
  };
}

export async function getParserSettings() {
  const result = await query(`SELECT * FROM parser_settings WHERE id = 1`);
  return mapSettings(result.rows[0]);
}

export async function updateParserSettings(input) {
  const current = await getParserSettings();
  const next = {
    enabled:
      typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    auto_import_on_search:
      typeof input.auto_import_on_search === "boolean"
        ? input.auto_import_on_search
        : current.auto_import_on_search,
    hourly_limit:
      Number.isInteger(input.hourly_limit) && input.hourly_limit > 0
        ? input.hourly_limit
        : current.hourly_limit,
    request_delay_ms:
      Number.isInteger(input.request_delay_ms) && input.request_delay_ms >= 0
        ? input.request_delay_ms
        : current.request_delay_ms,
    worker_concurrency:
      Number.isInteger(input.worker_concurrency) && input.worker_concurrency > 0
        ? input.worker_concurrency
        : current.worker_concurrency,
  };

  const result = await query(
    `
      UPDATE parser_settings
      SET
        enabled = $1,
        auto_import_on_search = $2,
        hourly_limit = $3,
        request_delay_ms = $4,
        worker_concurrency = $5,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `,
    [
      next.enabled,
      next.auto_import_on_search,
      next.hourly_limit,
      next.request_delay_ms,
      next.worker_concurrency,
    ],
  );

  return mapSettings(result.rows[0]);
}

export async function requestParserStop() {
  const result = await query(
    `
      UPDATE parser_settings
      SET stop_requested = TRUE, updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `,
  );

  return mapSettings(result.rows[0]);
}

export async function clearParserStopRequest() {
  await query(
    `
      UPDATE parser_settings
      SET stop_requested = FALSE, updated_at = NOW()
      WHERE id = 1
    `,
  );
}

export async function getRecentParserJobs(limit = 10) {
  const result = await query(
    `
      SELECT *
      FROM parser_jobs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapJob);
}

export async function getParserJob(jobId) {
  const result = await query(`SELECT * FROM parser_jobs WHERE id = $1`, [jobId]);
  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function createParserJob({
  queryText,
  triggerType,
  jobKind = "search",
  status = "running",
}) {
  const result = await query(
    `
      INSERT INTO parser_jobs (
        query,
        trigger_type,
        job_kind,
        status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [queryText, triggerType, jobKind, status],
  );

  return mapJob(result.rows[0]);
}

export async function updateParserJobProgress(jobId, patch) {
  const result = await query(
    `
      UPDATE parser_jobs
      SET
        status = COALESCE($2, status),
        parsed_count = COALESCE($3, parsed_count),
        imported_count = COALESCE($4, imported_count),
        discovered_tracks = COALESCE($5, discovered_tracks),
        discovered_artists = COALESCE($6, discovered_artists),
        processed_pages = COALESCE($7, processed_pages)
      WHERE id = $1
      RETURNING *
    `,
    [
      jobId,
      patch.status ?? null,
      patch.parsed_count ?? null,
      patch.imported_count ?? null,
      patch.discovered_tracks ?? null,
      patch.discovered_artists ?? null,
      patch.processed_pages ?? null,
    ],
  );

  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function completeParserJob(jobId, patch = {}) {
  const result = await query(
    `
      UPDATE parser_jobs
      SET
        status = $2,
        parsed_count = COALESCE($3, parsed_count),
        imported_count = COALESCE($4, imported_count),
        discovered_tracks = COALESCE($5, discovered_tracks),
        discovered_artists = COALESCE($6, discovered_artists),
        processed_pages = COALESCE($7, processed_pages),
        finished_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      jobId,
      patch.status || "completed",
      patch.parsed_count ?? null,
      patch.imported_count ?? null,
      patch.discovered_tracks ?? null,
      patch.discovered_artists ?? null,
      patch.processed_pages ?? null,
    ],
  );

  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function failParserJob(jobId, errorMessage, patch = {}) {
  const result = await query(
    `
      UPDATE parser_jobs
      SET
        status = $2,
        error_message = $3,
        parsed_count = COALESCE($4, parsed_count),
        imported_count = COALESCE($5, imported_count),
        discovered_tracks = COALESCE($6, discovered_tracks),
        discovered_artists = COALESCE($7, discovered_artists),
        processed_pages = COALESCE($8, processed_pages),
        finished_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      jobId,
      patch.status || "failed",
      errorMessage,
      patch.parsed_count ?? null,
      patch.imported_count ?? null,
      patch.discovered_tracks ?? null,
      patch.discovered_artists ?? null,
      patch.processed_pages ?? null,
    ],
  );

  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function appendParserJobEvent(jobId, { level = "info", message, meta = null }) {
  const result = await query(
    `
      INSERT INTO parser_job_events (job_id, level, message, meta)
      VALUES ($1, $2, $3, $4)
      RETURNING id, job_id, level, message, meta, created_at
    `,
    [jobId, level, message, meta ? JSON.stringify(meta) : null],
  );

  return result.rows[0];
}

export async function getParserJobEvents(jobId, limit = 100) {
  const result = await query(
    `
      SELECT id, job_id, level, message, meta, created_at
      FROM parser_job_events
      WHERE job_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [jobId, limit],
  );

  return result.rows;
}

export async function importTracksWithQuota({ parsedTracks, importTracks }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const settingsResult = await client.query(
      `SELECT * FROM parser_settings WHERE id = 1 FOR UPDATE`,
    );
    const settings = settingsResult.rows[0];
    const window = normalizeSettingsWindow(settings);
    const remaining = Math.max(
      settings.hourly_limit - window.itemsProcessedThisHour,
      0,
    );
    const allowedTracks = parsedTracks.slice(0, remaining);
    const importedTracks =
      allowedTracks.length > 0 ? await importTracks(client, allowedTracks) : [];

    await client.query(
      `
        UPDATE parser_settings
        SET
          items_processed_this_hour = $1,
          hour_window_started_at = $2,
          updated_at = NOW()
        WHERE id = 1
      `,
      [
        window.itemsProcessedThisHour + importedTracks.length,
        window.hourWindowStartedAt.toISOString(),
      ],
    );

    await client.query("COMMIT");

    return {
      importedTracks,
      importedCount: importedTracks.length,
      parsedCount: parsedTracks.length,
      remainingHourlyQuota: Math.max(
        settings.hourly_limit -
          (window.itemsProcessedThisHour + importedTracks.length),
        0,
      ),
      limitReached: importedTracks.length < parsedTracks.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
