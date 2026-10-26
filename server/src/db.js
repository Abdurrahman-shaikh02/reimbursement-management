import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? 'rms_app',
  password: process.env.DB_PASSWORD ?? 'rms_app_pass',
  database: process.env.DB_NAME ?? 'rms',
  connectionLimit: 10,
  // DATE columns come back as 'YYYY-MM-DD' strings, so no time-zone shifts.
  dateStrings: true,
  // DECIMAL columns come back as JS numbers (amounts here stay well below 2^53).
  decimalNumbers: true,
});

// Every query is parameterised (? placeholders), never built by string
// concatenation, so user input cannot change the SQL that runs.
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Runs fn(conn) inside one transaction: all of its statements commit
// together or none of them do.
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
