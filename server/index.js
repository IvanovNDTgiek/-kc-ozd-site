import express from 'express';
import rateLimit from 'express-rate-limit';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDatabase, closeDatabase, insertContactSubmission, pingDatabase } from './db.js';
import { mountAuthRoutes } from './auth-routes.js';
import { stripAndTruncate } from './sanitize.js';
import {
  validateEmail,
  validatePhoneOptional,
  validatePersonName,
  validateRequiredText,
} from '../js/modules/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Пути, которые нельзя отдавать как статику */
const BLOCKED_STATIC_PREFIXES = [
  '/node_modules',
  '/server',
  '/data',
  '/scripts',
  '/tests',
  '/.env',
  '/.git',
];

/**
 * @param {import('express').Express} app
 * @param {number} port
 * @param {string} host
 * @returns {Promise<import('http').Server>}
 */
function listenOnPort(app, port, host) {
  return new Promise(function (resolve, reject) {
    var srv = app.listen(port, host, function () {
      resolve(srv);
    });
    srv.on('error', function (err) {
      reject(err);
    });
  });
}

/**
 * @returns {string[]}
 */
function getLanIPv4Addresses() {
  var nets = os.networkInterfaces();
  var out = [];
  for (var name of Object.keys(nets)) {
    var group = nets[name];
    if (!group) {
      continue;
    }
    for (var i = 0; i < group.length; i++) {
      var net = group[i];
      if (!net || net.internal) {
        continue;
      }
      var fam = net.family;
      if (fam === 'IPv4' || fam === 4) {
        out.push(net.address);
      }
    }
  }
  return out;
}

/**
 * @param {import('express').Express} app
 */
function mountSafeStatic(app) {
  app.use(function (req, res, next) {
    var p = req.path || '';
    for (var i = 0; i < BLOCKED_STATIC_PREFIXES.length; i++) {
      if (p === BLOCKED_STATIC_PREFIXES[i] || p.startsWith(BLOCKED_STATIC_PREFIXES[i] + '/')) {
        return res.status(404).end();
      }
    }
    next();
  });
  app.use(
    express.static(root, {
      dotfiles: 'deny',
      index: ['index.html'],
    }),
  );
}

async function main() {
  var databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !String(databaseUrl).trim()) {
    process.stderr.write(
      'Ошибка: задайте DATABASE_URL (PostgreSQL).\n' +
        '  Локально: docker compose up -d db  и скопируйте .env.example → .env\n' +
        '  Облако: Neon / Supabase / Railway — вставьте connection string в .env\n' +
        '  Подробнее: DEPLOY.md\n',
    );
    process.exit(1);
    return;
  }

  /** @type {import('./db.js').DbPool} */
  var db;
  try {
    db = await openDatabase(databaseUrl);
  } catch (e) {
    process.stderr.write(
      'Ошибка подключения к PostgreSQL. Проверьте DATABASE_URL и что БД запущена.\n' +
        String(e && e.message ? e.message : e) +
        '\n',
    );
    process.exit(1);
    return;
  }

  var app = express();
  app.disable('x-powered-by');

  if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '48kb' }));

  var contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  });

  var authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post('/api/contact', contactLimiter, async function (req, res) {
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var name = stripAndTruncate(body.name, 120);
    var email = stripAndTruncate(body.email, 254).toLowerCase();
    var phone = stripAndTruncate(body.phone, 32);
    var message = stripAndTruncate(body.message, 4000);

    if (!validatePersonName(name)) {
      return res.status(400).json({ ok: false, error: 'name', message: 'Некорректное имя.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'email', message: 'Некорректный e-mail.' });
    }
    if (!validatePhoneOptional(phone)) {
      return res.status(400).json({ ok: false, error: 'phone', message: 'Некорректный телефон.' });
    }
    if (!validateRequiredText(message, 4000)) {
      return res.status(400).json({ ok: false, error: 'message', message: 'Введите сообщение.' });
    }

    try {
      var id = await insertContactSubmission(db, {
        name: name,
        email: email,
        phone: phone,
        message: message,
      });
      return res.status(201).json({ ok: true, id: id });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'server', message: 'Ошибка записи в базу.' });
    }
  });

  app.get('/api/health', async function (_req, res) {
    try {
      await pingDatabase(db);
      return res.json({ ok: true, db: true });
    } catch (e) {
      return res.status(503).json({ ok: false, db: false });
    }
  });

  mountAuthRoutes(app, db, authLimiter);
  mountSafeStatic(app);

  var basePort = Number(process.env.PORT);
  if (!Number.isFinite(basePort) || basePort < 1) {
    basePort = 3000;
  }

  var host = typeof process.env.HOST === 'string' && process.env.HOST.trim() ? process.env.HOST.trim() : '0.0.0.0';

  var lastErr = null;
  var server = null;
  for (var p = basePort; p < basePort + 25; p++) {
    try {
      server = await listenOnPort(app, p, host);
      process.stdout.write('\n--- Локально (этот ПК) ---\n');
      process.stdout.write('http://127.0.0.1:' + p + '/\n');
      process.stdout.write('http://127.0.0.1:' + p + '/contacts.html\n');

      if (host === '0.0.0.0' || host === '::') {
        var addrs = getLanIPv4Addresses();
        if (addrs.length) {
          process.stdout.write('\n--- Сеть (телефон / планшет / другой ПК в одной Wi-Fi) ---\n');
          for (var a = 0; a < addrs.length; a++) {
            process.stdout.write('http://' + addrs[a] + ':' + p + '/\n');
            process.stdout.write('http://' + addrs[a] + ':' + p + '/contacts.html\n');
          }
        }
      }

      var siteUrl = process.env.SITE_URL || '';
      if (siteUrl) {
        process.stdout.write('\nПубличный URL (SITE_URL): ' + siteUrl + '\n');
      }
      process.stdout.write('\nPostgreSQL подключена.\n');
      process.stdout.write('HOST=' + host + '\n');
      if (p !== basePort) {
        process.stdout.write('(порт ' + basePort + ' был занят — использован ' + p + ')\n');
      }

      var shutdown = async function () {
        if (server) {
          server.close();
        }
        await closeDatabase(db);
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      return;
    } catch (e) {
      lastErr = e;
      if (e && e.code === 'EADDRINUSE') {
        continue;
      }
      throw e;
    }
  }

  await closeDatabase(db);
  process.stderr.write(
    'Не удалось занять порт с ' +
      basePort +
      '. Закройте старый node либо задайте другой порт:\n' +
      '  set PORT=3010\n' +
      '  npm run server\n',
  );
  if (lastErr) {
    process.stderr.write(String(lastErr.message || lastErr) + '\n');
  }
  process.exit(1);
}

main().catch(function (e) {
  process.stderr.write('Ошибка запуска: ' + String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
