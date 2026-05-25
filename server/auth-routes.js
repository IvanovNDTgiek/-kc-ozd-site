import crypto from 'crypto';
import {
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsForUser,
  getSessionUser,
  getUserByEmail,
  insertSession,
  insertUser,
} from './db.js';
import { hashPassword, verifyPassword } from './password.js';
import { stripAndTruncate } from './sanitize.js';
import { validateDisplayName, validateEmail, validatePassword } from '../js/modules/validation.js';

var COOKIE_NAME = 'sid';
var SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @returns {boolean}
 */
function useSecureCookies() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    process.env.VERCEL === '1'
  );
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function readSessionCookie(req) {
  var raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  var parts = raw.split(';');
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i].trim();
    if (seg.indexOf(COOKIE_NAME + '=') === 0) {
      try {
        return decodeURIComponent(seg.slice(COOKIE_NAME.length + 1).trim());
      } catch (e) {
        return '';
      }
    }
  }
  return '';
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setSessionCookie(res, token) {
  var maxAge = Math.floor(SESSION_MS / 1000);
  var cookie =
    COOKIE_NAME +
    '=' +
    encodeURIComponent(token) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
    String(maxAge);
  if (useSecureCookies()) {
    cookie += '; Secure';
  }
  res.append('Set-Cookie', cookie);
}

/**
 * @param {import('express').Response} res
 */
export function clearSessionCookie(res) {
  var cookie = COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  if (useSecureCookies()) {
    cookie += '; Secure';
  }
  res.append('Set-Cookie', cookie);
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('./db.js').DbPool} db
 * @returns {Promise<{ userId: number; email: string; display_name: string } | null>}
 */
export async function resolveSessionUser(req, db) {
  await deleteExpiredSessions(db);
  var token = readSessionCookie(req);
  if (!token) {
    return null;
  }
  return getSessionUser(db, token, Date.now());
}

/**
 * @param {import('express').Express} app
 * @param {import('./db.js').DbPool} db
 * @param {import('express').RequestHandler} [authLimiter]
 */
export function mountAuthRoutes(app, db, authLimiter) {
  var lim =
    typeof authLimiter === 'function'
      ? authLimiter
      : function (_req, _res, next) {
          next();
        };

  app.get('/api/auth/me', lim, async function (req, res) {
    try {
      await deleteExpiredSessions(db);
      var token = readSessionCookie(req);
      if (!token) {
        return res.status(401).json({ ok: false });
      }
      var u = await getSessionUser(db, token, Date.now());
      if (!u) {
        return res.status(401).json({ ok: false });
      }
      return res.json({
        ok: true,
        user: { email: u.email, display_name: u.display_name },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'server', message: 'Ошибка сервера.' });
    }
  });

  app.post('/api/auth/register', lim, async function (req, res) {
    try {
      await deleteExpiredSessions(db);
      var body = req.body && typeof req.body === 'object' ? req.body : {};
      var displayName = stripAndTruncate(body.display_name, 80);
      var email = stripAndTruncate(body.email, 254).toLowerCase();
      var password = typeof body.password === 'string' ? body.password : '';
      var passwordConfirm = typeof body.password_confirm === 'string' ? body.password_confirm : '';

      if (!validateDisplayName(displayName)) {
        return res.status(400).json({
          ok: false,
          error: 'display_name',
          message: 'Имя: только буквы (без пробелов, цифр и знаков), от 2 до 80 символов.',
        });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ ok: false, error: 'email', message: 'Введите корректный e-mail.' });
      }
      if (!validatePassword(password)) {
        return res.status(400).json({
          ok: false,
          error: 'password',
          message: 'Пароль: 8–128 символов, нужна хотя бы одна буква и одна цифра.',
        });
      }
      if (password !== passwordConfirm) {
        return res.status(400).json({ ok: false, error: 'password_confirm', message: 'Пароли не совпадают.' });
      }

      if (await getUserByEmail(db, email)) {
        return res.status(409).json({
          ok: false,
          error: 'email',
          message: 'Этот e-mail уже зарегистрирован.',
        });
      }

      var hp = hashPassword(password);
      var userId = await insertUser(db, {
        email: email,
        displayName: displayName,
        salt: hp.salt,
        hash: hp.hash,
      });
      var token = crypto.randomBytes(32).toString('hex');
      var exp = Date.now() + SESSION_MS;
      await insertSession(db, token, userId, exp);
      setSessionCookie(res, token);
      return res.status(201).json({
        ok: true,
        user: { email: email, display_name: displayName },
      });
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      if (msg.toLowerCase().indexOf('unique') !== -1 || msg.indexOf('duplicate') !== -1) {
        return res.status(409).json({
          ok: false,
          error: 'email',
          message: 'Этот e-mail уже зарегистрирован.',
        });
      }
      return res.status(500).json({ ok: false, error: 'server', message: 'Не удалось создать учётную запись.' });
    }
  });

  app.post('/api/auth/login', lim, async function (req, res) {
    try {
      await deleteExpiredSessions(db);
      var body = req.body && typeof req.body === 'object' ? req.body : {};
      var email = stripAndTruncate(body.email, 254).toLowerCase();
      var password = typeof body.password === 'string' ? body.password : '';

      if (!validateEmail(email)) {
        return res.status(400).json({ ok: false, error: 'email', message: 'Введите корректный e-mail.' });
      }
      if (!password) {
        return res.status(400).json({ ok: false, error: 'password', message: 'Введите пароль.' });
      }

      var user = await getUserByEmail(db, email);
      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        return res.status(401).json({ ok: false, message: 'Неверный e-mail или пароль.' });
      }

      await deleteSessionsForUser(db, user.id);
      var token = crypto.randomBytes(32).toString('hex');
      var exp = Date.now() + SESSION_MS;
      await insertSession(db, token, user.id, exp);
      setSessionCookie(res, token);
      return res.json({
        ok: true,
        user: { email: user.email, display_name: user.display_name },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'server', message: 'Ошибка входа.' });
    }
  });

  app.post('/api/auth/logout', lim, async function (req, res) {
    try {
      var token = readSessionCookie(req);
      if (token) {
        await deleteSession(db, token);
      }
      clearSessionCookie(res);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'server', message: 'Ошибка выхода.' });
    }
  });
}
