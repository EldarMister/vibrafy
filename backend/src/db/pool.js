import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/telegram_music";

export const pool = new pg.Pool({
  connectionString,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

