import nodemailer from 'nodemailer';

var DEFAULT_TO = 'kcozdofficial@gmail.com';

/**
 * @returns {boolean}
 */
export function isMailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    String(process.env.SMTP_PASS).trim()
  );
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
      pass: process.env.SMTP_PASS,
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
    return { sent: false, skipped: true, error: 'CONTACT_EMAIL_TO empty' };
  }

  if (!isMailConfigured()) {
    process.stderr.write(
      'Почта не настроена: задайте SMTP_HOST, SMTP_USER, SMTP_PASS в .env (см. .env.example).\n',
    );
    return { sent: false, skipped: true, error: 'smtp_not_configured' };
  }

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

  var transporter = createTransporter();
  await transporter.sendMail({
    from: from,
    to: to,
    replyTo: row.email,
    subject: subject,
    text: text,
    html: html,
  });

  return { sent: true };
}
