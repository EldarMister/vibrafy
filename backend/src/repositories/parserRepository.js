import { pool, query } from "../db/pool.js";

function mapSettings(row) {
  return {
    enabled: row.enabled,
    auto_import_on_search: row.auto_import_on_search,
    hourly_limit: row.hourly_limit,
    request_delay_ms: row.request_delay_ms,
    items_processed_this_hour: row.items_processed_this_hour,
    hour_window_started_at: row.hour_window_started_at,
    updated_at: row.updated_at,
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
  };

  const result = await query(
    `
      UPDATE parser_settings
      SET
        enabled = $1,
        auto_import_on_search = $2,
        hourly_limit = $3,
        request_delay_ms = $4,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `,
    [
      next.enabled,
      next.auto_import_on_search,
      next.hourly_limit,
      next.request_delay_ms,
    ],
  );

  return mapSettings(result.rows[0]);
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

  return result.rows;
}

export async function recordParserFailure({ queryText, triggerType, parsedCount = 0, errorMessage }) {
  await query(
    `
      INSERT INTO parser_jobs (
        query,
        trigger_type,
        status,
        parsed_count,
        imported_count,
        error_message,
        finished_at
      )
      VALUES ($1, $2, 'failed', $3, 0, $4, NOW())
    `,
    [queryText, triggerType, parsedCount, errorMessage],
  );
}

export async function importTracksWithLimit({ queryText, triggerType, parsedTracks, importTracks }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const settingsResult = await client.query(
      `SELECT * FROM parser_settings WHERE id = 1 FOR UPDATE`,
    );
    const settings = settingsResult.rows[0];
    const now = new Date();
    const hourStartedAt = new Date(settings.hour_window_started_at);
    const nextState = {
      itemsProcessed: settings.items_processed_this_hour,
      hourStartedAt,
    };

    if (now.getTime() - hourStartedAt.getTime() >= 60 * 60 * 1000) {
      nextState.itemsProcessed = 0;
      nextState.hourStartedAt = now;
    }

    const remaining = Math.max(
      settings.hourly_limit - nextState.itemsProcessed,
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
        nextState.itemsProcessed + importedTracks.length,
        nextState.hourStartedAt.toISOString(),
      ],
    );

    await client.query(
      `
        INSERT INTO parser_jobs (
          query,
          trigger_type,
          status,
          parsed_count,
          imported_count,
          finished_at
        )
        VALUES ($1, $2, 'completed', $3, $4, NOW())
      `,
      [queryText, triggerType, parsedTracks.length, importedTracks.length],
    );

    await client.query("COMMIT");

    return {
      importedTracks,
      importedCount: importedTracks.length,
      parsedCount: parsedTracks.length,
      remainingHourlyQuota: Math.max(
        settings.hourly_limit -
          (nextState.itemsProcessed + importedTracks.length),
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

