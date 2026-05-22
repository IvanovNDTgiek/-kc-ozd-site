/**
 * Проверка DATABASE_URL без запуска сервера.
 * npm run db:test
 */
import pg from 'pg';

var url = process.env.DATABASE_URL;
if (!url || !String(url).trim()) {
  process.stderr.write('DATABASE_URL пуст. Заполните .env\n');
  process.exit(1);
}

if (/xxxx|\.\.\.\./i.test(url)) {
  process.stderr.write('В URL есть шаблоны xxxx или .... — вставьте реальную строку из Supabase.\n');
  process.exit(1);
}

var ssl =
  process.env.DATABASE_SSL === 'true' || /\.supabase\.com/i.test(url)
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;

var pool = new pg.Pool({
  connectionString: url.trim(),
  ssl,
  connectionTimeoutMillis: 15000,
  prepare: false,
});

try {
  var r = await pool.query('SELECT 1 AS ok');
  process.stdout.write('OK: PostgreSQL доступна (' + JSON.stringify(r.rows[0]) + ')\n');
} catch (e) {
  if (e && e.errors) {
    for (var err of e.errors) {
      process.stderr.write(String(err.message || err) + '\n');
    }
  } else {
    process.stderr.write(String(e && e.message ? e.message : e) + '\n');
  }
  process.stderr.write(
    '\nПодсказка: Supabase → Settings → Database → Connection string → URI (Transaction, port 6543).\n' +
      'Пароль со спецсимволами (!@#) закодируйте в URL или задайте новый пароль в Supabase.\n',
  );
  process.exit(1);
} finally {
  await pool.end();
}
