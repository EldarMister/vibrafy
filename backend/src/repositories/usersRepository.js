import { query } from "../db/pool.js";

export async function upsertTelegramUser(user) {
  if (!user?.id) {
    return null;
  }

  const result = await query(
    `
      INSERT INTO telegram_users (
        telegram_id,
        username,
        first_name,
        last_name,
        last_seen_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (telegram_id) DO UPDATE
      SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        last_seen_at = NOW()
      RETURNING id, telegram_id, username, first_name, last_name, created_at, last_seen_at
    `,
    [user.id, user.username || null, user.first_name || null, user.last_name || null],
  );

  return result.rows[0];
}

export async function countUsers() {
  const result = await query(`SELECT COUNT(*)::INT AS total FROM telegram_users`);
  return result.rows[0].total;
}

