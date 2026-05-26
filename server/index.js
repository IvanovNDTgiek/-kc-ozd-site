import os from 'os';
import { createApp } from './app.js';
import { closeDatabase } from './db.js';
import { isMailConfigured } from './mail.js';

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

async function main() {
  /** @type {import('express').Express} */
  var app;
  try {
    app = await createApp();
  } catch (e) {
    var detail = '';
    if (e && e.errors && Array.isArray(e.errors)) {
      detail = e.errors
        .map(function (err) {
          return String(err && err.message ? err.message : err);
        })
        .join('\n  ');
    } else if (e && e.message) {
      detail = String(e.message);
    } else {
      detail = String(e);
    }
    process.stderr.write(
      'Ошибка подключения к PostgreSQL. Проверьте DATABASE_URL в .env\n' + detail + '\n',
    );
    process.exit(1);
    return;
  }

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
          process.stdout.write('\n--- Сеть ---\n');
          for (var a = 0; a < addrs.length; a++) {
            process.stdout.write('http://' + addrs[a] + ':' + p + '/\n');
          }
        }
      }

      var siteUrl = process.env.SITE_URL || '';
      if (siteUrl) {
        process.stdout.write('\nSITE_URL: ' + siteUrl + '\n');
      }
      process.stdout.write('\nPostgreSQL подключена.\n');
      if (isMailConfigured()) {
        var mailTo = (process.env.CONTACT_EMAIL_TO || 'kcozdofficial@gmail.com').trim();
        process.stdout.write('Почта: заявки с формы → ' + mailTo + '\n');
      } else {
        process.stdout.write(
          'Почта: не настроена — укажите SMTP_PASS (пароль приложения Google) в .env\n',
        );
      }
      if (p !== basePort) {
        process.stdout.write('(порт ' + basePort + ' занят — использован ' + p + ')\n');
      }

      process.on('SIGINT', function () {
        if (server) {
          server.close();
        }
        process.exit(0);
      });
      process.on('SIGTERM', function () {
        if (server) {
          server.close();
        }
        process.exit(0);
      });
      return;
    } catch (e) {
      lastErr = e;
      if (e && e.code === 'EADDRINUSE') {
        continue;
      }
      throw e;
    }
  }

  process.stderr.write('Не удалось занять порт с ' + basePort + '.\n');
  if (lastErr) {
    process.stderr.write(String(lastErr.message || lastErr) + '\n');
  }
  process.exit(1);
}

main().catch(function (e) {
  process.stderr.write('Ошибка запуска: ' + String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
