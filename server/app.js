import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDatabase, insertContactSubmission, pingDatabase } from './db.js';
import { sendContactNotification } from './mail.js';
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

const BLOCKED_STATIC_PREFIXES = [
  '/node_modules',
  '/server',
  '/data',
  '/scripts',
  '/tests',
  '/.env',
  '/.git',
  '/api',
];

/** @type {Promise<import('express').Express> | null} */
var appReady = null;

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

/**
 * @returns {Promise<import('express').Express>}
 */
export async function createApp() {
  if (appReady) {
    return appReady;
  }

  appReady = (async function () {
    var databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !String(databaseUrl).trim()) {
      throw new Error('DATABASE_URL не задан');
    }

    var db = await openDatabase(databaseUrl);
    var app = express();
    app.disable('x-powered-by');

    if (
      process.env.TRUST_PROXY === 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1'
    ) {
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

        try {
          await sendContactNotification({
            id: id,
            name: name,
            email: email,
            phone: phone,
            message: message,
          });
        } catch (mailErr) {
          process.stderr.write(
            'Заявка #' + id + ' сохранена, но письмо не отправлено: ' + String(mailErr && mailErr.message ? mailErr.message : mailErr) + '\n',
          );
        }

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

    return app;
  })();

  return appReady;
}
