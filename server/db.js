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

const MIGRATION_SQL = `
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contact_user ON contact_submissions(user_id);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
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
 * @param {string} sql
 * @returns {string[]}
 */
function splitSqlStatements(sql) {
  return String(sql || '')
    .split(';')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s.length > 0;
    });
}

/**
 * @param {{ query: (sql: string) => Promise<unknown> }} runner
 * @param {string} sql
 */
async function runSqlStatements(runner, sql) {
  var parts = splitSqlStatements(sql);
  for (var i = 0; i < parts.length; i++) {
    await runner.query(parts[i]);
  }
}

/**
 * Для Supabase: DDL через transaction pooler (6543) даёт ECONNRESET — используем session (5432).
 * @param {string} connectionString
 * @returns {string}
 */
function schemaConnectionString(connectionString) {
  var cs = String(connectionString || '').trim();
  if (/\.supabase\.com:6543/i.test(cs)) {
    cs = cs.replace(/:6543\//, ':5432/');
    cs = cs.replace(/[?&]pgbouncer=true/gi, '');
    cs = cs.replace(/[?&]$/, '');
  }
  return cs;
}

/**
 * @param {string} connectionString
 */
async function ensureSchema(connectionString) {
  var cs = schemaConnectionString(connectionString);
  var client = new pg.Client({
    connectionString: cs,
    ssl: sslConfig(connectionString),
    connectionTimeoutMillis: 20000,
  });
  client.on('error', function () {
    /* игнорируем фоновые ошибки закрытого соединения */
  });
  try {
    await client.connect();
    await runSqlStatements(client, SCHEMA_SQL);
    await runSqlStatements(client, MIGRATION_SQL);
  } finally {
    try {
      await client.end();
    } catch (e) {
      /* already closed */
    }
  }
}

/**
 * @param {DbPool} pool
 * @returns {Promise<boolean>}
 */
async function tablesReady(pool) {
  var r = await pool.query(
    `SELECT to_regclass('public.users') AS users, to_regclass('public.sessions') AS sessions`,
  );
  return !!(r.rows[0] && r.rows[0].users && r.rows[0].sessions);
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
    connectionTimeoutMillis: 15000,
    // Supabase pooler (порт 6543) не поддерживает prepared statements в node-pg
    prepare: false,
  });

  if (await tablesReady(pool)) {
    try {
      await runSqlStatements(pool, MIGRATION_SQL);
    } catch (migrationErr) {
      process.stderr.write(
        'Предупреждение: миграция user_id не применена: ' +
          String(migrationErr && migrationErr.message ? migrationErr.message : migrationErr) +
          '\n',
      );
    }
    return pool;
  }

  await ensureSchema(cs);
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
 * @param {{ name: string; email: string; phone: string; message: string; userId?: number | null }} row
 * @returns {Promise<number>}
 */
export async function insertContactSubmission(pool, row) {
  var userId = row.userId != null && Number.isFinite(Number(row.userId)) ? Number(row.userId) : null;
  var r = await pool.query(
    'INSERT INTO contact_submissions (name, email, phone, message, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [row.name, row.email, row.phone, row.message, userId],
  );
  return Number(r.rows[0].id);
}

/**
 * @param {DbPool} pool
 * @param {number} userId
 * @returns {Promise<{ id: number; email: string; display_name: string; created_at: string } | null>}
 */
export async function getUserById(pool, userId) {
  var r = await pool.query(
    'SELECT id, email, display_name, created_at FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );
  if (!r.rows.length) {
    return null;
  }
  var o = r.rows[0];
  return {
    id: Number(o.id),
    email: String(o.email),
    display_name: String(o.display_name),
    created_at: o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at),
  };
}

/**
 * @param {DbPool} pool
 * @param {number} userId
 * @param {string} email
 * @returns {Promise<{ id: number; created_at: string; name: string; email: string; phone: string; message: string }[]>}
 */
export async function getContactSubmissionsForUser(pool, userId, email) {
  var r = await pool.query(
    `SELECT id, created_at, name, email, phone, message
     FROM contact_submissions
     WHERE user_id = $1 OR (user_id IS NULL AND lower(email) = lower($2))
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId, email],
  );
  return r.rows.map(function (o) {
    return {
      id: Number(o.id),
      created_at: o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at),
      name: String(o.name),
      email: String(o.email),
      phone: String(o.phone || ''),
      message: String(o.message),
    };
  });
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

/**
 * @param {DbPool} pool
 * @param {number} userId
 * @returns {Promise<{ id: string; title: string; href: string; excerpt: string; kind: string }[]>}
 */
export async function getUserFavorites(pool, userId) {
  var r = await pool.query(
    `SELECT item_id, title, href, excerpt, kind
     FROM user_favorites
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );
  return r.rows.map(function (o) {
    return {
      id: String(o.item_id),
      title: String(o.title || ''),
      href: String(o.href || ''),
      excerpt: String(o.excerpt || ''),
      kind: String(o.kind || ''),
    };
  });
}

/**
 * @param {DbPool} pool
 * @param {number} userId
 * @param {{ id: string; title: string; href: string; excerpt: string; kind: string }} item
 */
export async function upsertUserFavorite(pool, userId, item) {
  await pool.query(
    `INSERT INTO user_favorites (user_id, item_id, title, href, excerpt, kind)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, item_id) DO UPDATE SET
       title = EXCLUDED.title,
       href = EXCLUDED.href,
       excerpt = EXCLUDED.excerpt,
       kind = EXCLUDED.kind`,
    [userId, item.id, item.title, item.href, item.excerpt, item.kind],
  );
}

/**
 * @param {DbPool} pool
 * @param {number} userId
 * @param {string} itemId
 * @returns {Promise<boolean>} true if a row was removed
 */
export async function removeUserFavorite(pool, userId, itemId) {
  var r = await pool.query('DELETE FROM user_favorites WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
  return (r.rowCount || 0) > 0;
}
