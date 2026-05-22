/**
 * Подставляет SITE_URL в canonical и sitemap.xml.
 * Запуск: set SITE_URL=https://ваш-домен.ru && npm run site:url
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

var siteUrl = process.env.SITE_URL;
if (!siteUrl || !String(siteUrl).trim()) {
  process.stderr.write('Задайте SITE_URL, например: set SITE_URL=https://kc-ozd.ru\n');
  process.exit(1);
}

siteUrl = String(siteUrl).trim().replace(/\/+$/, '');
var oldBase = 'https://example.github.io/kc-ozd-site';

var htmlFiles = fs.readdirSync(root).filter(function (n) {
  return n.endsWith('.html');
});

for (var file of htmlFiles) {
  var fp = path.join(root, file);
  var text = fs.readFileSync(fp, 'utf8');
  if (text.indexOf(oldBase) === -1 && text.indexOf(siteUrl) !== -1) {
    continue;
  }
  var next = text.split(oldBase).join(siteUrl);
  fs.writeFileSync(fp, next, 'utf8');
  process.stdout.write('Обновлён: ' + file + '\n');
}

var sitemapPath = path.join(root, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  var sm = fs.readFileSync(sitemapPath, 'utf8');
  var smNext = sm.split(oldBase).join(siteUrl);
  fs.writeFileSync(sitemapPath, smNext, 'utf8');
  process.stdout.write('Обновлён: sitemap.xml\n');
}

process.stdout.write('\nSITE_URL=' + siteUrl + '\n');
