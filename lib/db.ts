import pg from "pg";
const globalDb = globalThis as unknown as { pool: pg.Pool };
export const pool = (globalDb.pool ||= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
}));
export const query = (sql: string, values: unknown[] = []) =>
  pool.query(sql, values);
