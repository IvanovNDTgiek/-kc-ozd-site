import nodemailer from 'nodemailer';

var DEFAULT_TO = 'kcozdofficial@gmail.com';

/** @type {RegExp[]} */
var SMTP_PASS_PLACEHOLDERS = [
  /^ваш_пароль/i,
  /^пароль_приложения/i,
  /^xxxx/i,
  /^your_/i,
  /^change_me/i,
  /^password$/i,
];

/**
 * @param {string} level
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 */
export function mailLog(level, message, extra) {
  var ts = new Date().toISOString();
  var line = '[' + ts + '] [mail] ' + message;
  if (extra && Object.keys(extra).length) {
    line += ' ' + JSON.stringify(extra);
  }
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * @param {string | undefined} pass
 * @returns {string}
 */
function normalizeSmtpPass(pass) {
  return String(pass || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * @param {string} pass
 * @returns {boolean}
 */
function isRealSmtpPass(pass) {
  var trimmed = normalizeSmtpPass(pass);
  if (!trimmed || trimmed.length < 8) {
    return false;
  }
  for (var i = 0; i < SMTP_PASS_PLACEHOLDERS.length; i++) {
    if (SMTP_PASS_PLACEHOLDERS[i].test(trimmed)) {
      return false;
    }
  }
  return true;
}

/**
 * @returns {boolean}
 */
export function isMailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    isRealSmtpPass(process.env.SMTP_PASS)
  );
}

/**
 * @returns {{ configured: boolean; to: string; user: string }}
 */
export function getMailConfigSummary() {
  return {
    configured: isMailConfigured(),
    to: (process.env.CONTACT_EMAIL_TO || DEFAULT_TO).trim(),
    user: String(process.env.SMTP_USER || '').trim(),
  };
}

/**
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function verifyMailConnection() {
  if (!isMailConfigured()) {
    return { ok: false, error: 'smtp_not_configured' };
  }
  try {
    var transporter = createTransporter();
    await transporter.verify();
    mailLog('info', 'SMTP-соединение проверено', {
      host: process.env.SMTP_HOST,
      user: process.env.SMTP_USER,
    });
    return { ok: true };
  } catch (e) {
    var msg = e && e.message ? String(e.message) : String(e);
    mailLog('error', 'SMTP verify failed', { error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * @returns {import('nodemailer').Transporter}
 */
function createTransporter() {
  var port = Number(process.env.SMTP_PORT);
  if (!Number.isFinite(port) || port < 1) {
    port = 587;
  }
  var secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: normalizeSmtpPass(process.env.SMTP_PASS),
    },
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ id: number; name: string; email: string; phone: string; message: string }} row
 * @returns {Promise<{ sent: boolean; skipped?: boolean; error?: string }>}
 */
export async function sendContactNotification(row) {
  var to = (process.env.CONTACT_EMAIL_TO || DEFAULT_TO).trim();
  if (!to) {
    mailLog('warn', 'Письмо не отправлено: CONTACT_EMAIL_TO пустой', { id: row.id });
    return { sent: false, skipped: true, error: 'CONTACT_EMAIL_TO empty' };
  }

  if (!isMailConfigured()) {
    mailLog('warn', 'Письмо не отправлено: SMTP не настроен в .env', {
      id: row.id,
      hint: 'SMTP_HOST, SMTP_USER, SMTP_PASS',
    });
    return { sent: false, skipped: true, error: 'smtp_not_configured' };
  }

  mailLog('info', 'Отправка письма по заявке…', { id: row.id, to: to, from: process.env.SMTP_USER });

  var from =
    process.env.SMTP_FROM && String(process.env.SMTP_FROM).trim()
      ? String(process.env.SMTP_FROM).trim()
      : '"Сайт КЦ ОЖД" <' + process.env.SMTP_USER + '>';

  var phoneLine = row.phone ? row.phone : '—';
  var subject = 'Заявка с сайта #' + row.id + ' — ' + row.name;

  var text =
    'Новая заявка с формы обратной связи\n\n' +
    'Номер: ' +
    row.id +
    '\n' +
    'Имя: ' +
    row.name +
    '\n' +
    'E-mail: ' +
    row.email +
    '\n' +
    'Телефон: ' +
    phoneLine +
    '\n\n' +
    'Сообщение:\n' +
    row.message +
    '\n';

  var html =
    '<h2>Новая заявка с сайта</h2>' +
    '<p><strong>Номер:</strong> ' +
    row.id +
    '</p>' +
    '<p><strong>Имя:</strong> ' +
    escapeHtml(row.name) +
    '</p>' +
    '<p><strong>E-mail:</strong> <a href="mailto:' +
    escapeHtml(row.email) +
    '">' +
    escapeHtml(row.email) +
    '</a></p>' +
    '<p><strong>Телефон:</strong> ' +
    escapeHtml(phoneLine) +
    '</p>' +
    '<p><strong>Сообщение:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">' +
    escapeHtml(row.message) +
    '</pre>';

  try {
    var transporter = createTransporter();
    var info = await transporter.sendMail({
      from: from,
      to: to,
      replyTo: row.email,
      subject: subject,
      text: text,
      html: html,
    });
    mailLog('info', 'Письмо отправлено', {
      id: row.id,
      to: to,
      messageId: info && info.messageId ? info.messageId : undefined,
      response: info && info.response ? info.response : undefined,
    });
    return { sent: true, messageId: info && info.messageId ? info.messageId : undefined };
  } catch (e) {
    var errMsg = e && e.message ? String(e.message) : String(e);
    mailLog('error', 'Ошибка отправки письма', { id: row.id, to: to, error: errMsg });
    throw e;
  }
}
