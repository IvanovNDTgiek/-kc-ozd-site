/**
 * Перенос данных из старого data/contacts.db (sql.js) в PostgreSQL.
 * Требует: npm install sql.js (один раз: npm install sql.js --no-save)
 * Запуск: npm run db:migrate-sqlite
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbPath = process.env.SQLITE_PATH || path.join(root, 'data', 'contacts.db');

if (!fs.existsSync(dbPath)) {
  process.stdout.write('Файл SQLite не найден: ' + dbPath + '\nНечего переносить.\n');
  process.exit(0);
}

var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write('Задайте DATABASE_URL.\n');
  process.exit(1);
}

var initSqlJs = (await import('sql.js')).default;
var distDir = path.join(root, 'node_modules', 'sql.js', 'dist');
var SQL = await initSqlJs({
  locateFile: function (file) {
    return path.join(distDir, file);
  },
});

var buf = fs.readFileSync(dbPath);
var sqlite = new SQL.Database(buf);
var { Pool } = pg;
var pool = new Pool({
  connectionString: databaseUrl.trim(),
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

await pool.query(`
CREATE TABLE IF NOT EXISTS contact_submissions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
`);

function sqliteRows(sql) {
  var res = sqlite.exec(sql);
  if (!res.length) {
    return [];
  }
  var cols = res[0].columns;
  return res[0].values.map(function (vals) {
    var o = {};
    for (var i = 0; i < cols.length; i++) {
      o[cols[i]] = vals[i];
    }
    return o;
  });
}

var contacts = sqliteRows('SELECT name, email, phone, message, created_at FROM contact_submissions ORDER BY id');
for (var c of contacts) {
  await pool.query(
    'INSERT INTO contact_submissions (name, email, phone, message, created_at) VALUES ($1, $2, $3, $4, $5)',
    [c.name, c.email, c.phone || '', c.message, c.created_at],
  );
}
process.stdout.write('Заявок перенесено: ' + contacts.length + '\n');

var users = sqliteRows(
  'SELECT email, display_name, password_salt, password_hash, created_at FROM users ORDER BY id',
);
var emailToId = new Map();
for (var u of users) {
  var ins = await pool.query(
    `INSERT INTO users (email, display_name, password_salt, password_hash, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [u.email, u.display_name, u.password_salt, u.password_hash, u.created_at],
  );
  if (ins.rows.length) {
    emailToId.set(String(u.email).toLowerCase(), Number(ins.rows[0].id));
  } else {
    var ex = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [u.email]);
    if (ex.rows.length) {
      emailToId.set(String(u.email).toLowerCase(), Number(ex.rows[0].id));
    }
  }
}
process.stdout.write('Пользователей: ' + users.length + '\n');

var sessions = sqliteRows(
  'SELECT s.token, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id',
);
var sessCount = 0;
for (var s of sessions) {
  var uid = emailToId.get(String(s.email).toLowerCase());
  if (!uid || Number(s.expires_at) < Date.now()) {
    continue;
  }
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING',
    [s.token, uid, s.expires_at],
  );
  sessCount++;
}
process.stdout.write('Активных сессий перенесено: ' + sessCount + '\n');

sqlite.close();
await pool.end();
process.stdout.write('Готово.\n');
