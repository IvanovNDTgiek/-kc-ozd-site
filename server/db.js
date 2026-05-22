import pg from 'pg';

const { Pool } = pg;

/** @typedef {import('pg').Pool} DbPool */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contact_submissions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_submissions(created_at);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

/**
 * @param {string} connectionString
 * @returns {boolean | import('tls').ConnectionOptions | undefined}
 */
function sslConfig(connectionString) {
  var url = String(connectionString || '');
  var wantSsl =
    process.env.DATABASE_SSL === 'true' || /sslmode=require/i.test(url) || /\.supabase\.com/i.test(url);
  if (wantSsl) {
    return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return undefined;
}

/**
 * @param {string} connectionString
 * @returns {Promise<DbPool>}
 */
export async function openDatabase(connectionString) {
  if (!connectionString || !String(connectionString).trim()) {
    throw new Error('DATABASE_URL не задан. Вставьте connection string из Supabase в .env');
  }

  var cs = String(connectionString).trim();
  if (/xxxx|\.\.\.\./i.test(cs)) {
    throw new Error(
      'В DATABASE_URL остались шаблоны xxxx или .... — вставьте полную строку из Supabase (Settings → Database → URI).',
    );
  }

  if (/\.supabase\.com:6543/i.test(cs) && !/[?&]pgbouncer=true/i.test(cs)) {
    cs += cs.includes('?') ? '&' : '?';
    cs += 'pgbouncer=true';
  }

  var pool = new Pool({
    connectionString: cs,
    ssl: sslConfig(cs),
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    // Supabase pooler (порт 6543) не поддерживает prepared statements в node-pg
    prepare: false,
  });

  await pool.query(SCHEMA_SQL);
  return pool;
}

/**
 * @param {DbPool} pool
 */
export async function closeDatabase(pool) {
  await pool.end();
}

/**
 * @param {DbPool} pool
 * @param {{ name: string; email: string; phone: string; message: string }} row
 * @returns {Promise<number>}
 */
export async function insertContactSubmission(pool, row) {
  var r = await pool.query(
    'INSERT INTO contact_submissions (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id',
    [row.name, row.email, row.phone, row.message],
  );
  return Number(r.rows[0].id);
}

/**
 * @param {DbPool} pool
 * @param {{ email: string; displayName: string; salt: string; hash: string }} row
 * @returns {Promise<number>}
 */
export async function insertUser(pool, row) {
  var r = await pool.query(
    'INSERT INTO users (email, display_name, password_salt, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [row.email, row.displayName, row.salt, row.hash],
  );
  return Number(r.rows[0].id);
}

/**
 * @param {DbPool} pool
 * @param {string} email
 * @returns {Promise<{ id: number; email: string; display_name: string; password_salt: string; password_hash: string } | null>}
 */
export async function getUserByEmail(pool, email) {
  var r = await pool.query(
    'SELECT id, email, display_name, password_salt, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  if (!r.rows.length) {
    return null;
  }
  var o = r.rows[0];
  return {
    id: Number(o.id),
    email: String(o.email),
    display_name: String(o.display_name),
    password_salt: String(o.password_salt),
    password_hash: String(o.password_hash),
  };
}

/**
 * @param {DbPool} pool
 */
export async function deleteExpiredSessions(pool) {
  await pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
}

/**
 * @param {DbPool} pool
 * @param {number} userId
 */
export async function deleteSessionsForUser(pool, userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/**
 * @param {DbPool} pool
 * @param {string} token
 * @param {number} userId
 * @param {number} expiresAtMs
 */
export async function insertSession(pool, token, userId, expiresAtMs) {
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAtMs]);
}

/**
 * @param {DbPool} pool
 * @param {string} token
 * @param {number} nowMs
 * @returns {Promise<{ userId: number; email: string; display_name: string } | null>}
 */
export async function getSessionUser(pool, token, nowMs) {
  var r = await pool.query(
    `SELECT u.id AS user_id, u.email AS email, u.display_name AS display_name
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > $2
     LIMIT 1`,
    [token, nowMs],
  );
  if (!r.rows.length) {
    return null;
  }
  var o = r.rows[0];
  return {
    userId: Number(o.user_id),
    email: String(o.email),
    display_name: String(o.display_name),
  };
}

/**
 * @param {DbPool} pool
 * @param {string} token
 */
export async function deleteSession(pool, token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

/**
 * @param {DbPool} pool
 * @returns {Promise<boolean>}
 */
export async function pingDatabase(pool) {
  await pool.query('SELECT 1');
  return true;
}
