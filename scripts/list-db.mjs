/**
 * Печать последних заявок из PostgreSQL.
 * Запуск: npm run db:list  (нужен DATABASE_URL в .env или окружении)
 */
import pg from 'pg';

const { Pool } = pg;

var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !String(databaseUrl).trim()) {
  process.stderr.write('Задайте DATABASE_URL (см. .env.example).\n');
  process.exit(1);
}

var ssl =
  process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;

var pool = new Pool({ connectionString: databaseUrl.trim(), ssl, prepare: false });

try {
  var r = await pool.query(
    `SELECT id, created_at, name, email, phone, left(message, 80) AS msg
     FROM contact_submissions
     ORDER BY id DESC
     LIMIT 50`,
  );

  if (!r.rows.length) {
    process.stdout.write('Таблица contact_submissions пуста.\n');
    process.exit(0);
  }

  process.stdout.write('Записей: ' + r.rows.length + '\n\n');
  for (var i = 0; i < r.rows.length; i++) {
    var row = r.rows[i];
    process.stdout.write('--- #' + (i + 1) + ' ---\n');
    for (var key of Object.keys(row)) {
      process.stdout.write(key + ': ' + String(row[key] != null ? row[key] : '') + '\n');
    }
    process.stdout.write('\n');
  }
} catch (e) {
  process.stderr.write('Ошибка: ' + String(e && e.message ? e.message : e) + '\n');
  process.exit(1);
} finally {
  await pool.end();
}
