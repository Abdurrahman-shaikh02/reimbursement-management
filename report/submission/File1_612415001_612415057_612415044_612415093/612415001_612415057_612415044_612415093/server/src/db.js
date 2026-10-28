// MySQL connection pool and two small helpers.
import mysql from 'mysql2/promise';
import { measureDatabase } from './timing.js';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  dateStrings: true,     // DATE columns come back as 'YYYY-MM-DD', not JS Date objects
  decimalNumbers: true,  // DECIMAL columns come back as numbers
});

// Runs one statement and returns its rows (or the result header for INSERT/UPDATE/DELETE).
export async function query(sql, params = []) {
  const conn = await measureDatabase(() => pool.getConnection(), true);
  try {
    const [rows] = await measureDatabase(() => conn.query(sql, params));
    return rows;
  } finally {
    conn.release();
  }
}

// Runs fn(conn) inside a transaction: commit if it returns, roll back if it throws.
export async function transaction(fn) {
  const conn = await measureDatabase(() => pool.getConnection(), true);
  // Wrap only query execution; timing the whole callback would include application work.
  const timedConn = {
    query(...args) {
      return measureDatabase(() => conn.query(...args));
    },

    execute(...args) {
      return measureDatabase(() => conn.execute(...args));
    },
  };

  try {
    await measureDatabase(() => conn.beginTransaction());
    const result = await fn(timedConn);
    await measureDatabase(() => conn.commit());
    return result;
  } catch (err) {
    await measureDatabase(() => conn.rollback());
    throw err;
  } finally {
    conn.release();
  }
}
