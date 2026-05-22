const fs = require('fs');
const path = require('path');
const wireframe = `# Структура сайта (по мотивам kc-ozd.ru)

## Карта страниц
- **index.html** — главная: hero, CTA, слайдер, преимущества, отзывы, футер, модалки
- **about.html** — о компании
- **services.html** — услуги, поиск, избранное (localStorage)
- **blog.html** — новости, поиск, избранное
- **favorites.html** — список избранного из localStorage
- **login.html** / **register.html** — вход и регистрация (API при `npm run server`)
- **contacts.html** — регионы, форма с валидацией и DOMPurify

## Общие блоки
- Шапка: навигация, бургер <768px, поиск (debounce)
- Подвал: раскрытие информации (модалка)
`;
const deploy_instructions =
  'Сохраните файлы в папку. Откройте через локальный HTTP-сервер (ES modules и DOMPurify ESM не работают с file:// в ряде браузеров). GitHub Pages: включите Pages на ветке с этими файлами. Netlify: корень как publish directory. Минификация: npx clean-css-cli -o css/style.min.css css/style.css; npx terser js/script.js -c -m -o js/script.min.js — затем замените пути в HTML на min-версии.';
const tests =
  'npm test — Node (tests/run-node-tests.mjs). Jest: npm install && npm run test:jest (использует node --experimental-vm-modules). Браузер: tests/unit-browser.html через локальный сервер. Responsive: DevTools 320/768/1024. Формы: невалидный email, короткий телефон, пустое сообщение.';
const bug_check =
  'Модалки: один глобальный Escape. Форма: демо-ответ без бэкенда. Поиск на главной без data-search-root — только на services/blog. GA: впишите G- ID в js/analytics.js. canonical/sitemap — замените example.github.io на ваш URL.';
const optimizations = [
  'SEO: JSON-LD Organization, реальные Open Graph изображения, уникальные title/description на каждой странице',
  'Perf: self-host Inter woff2, critical CSS inline с nonce при строгом CSP',
  'UX: focus trap в модалке, aria-live для слайдера, отправка формы на реальный endpoint (fetch + CSRF)',
];
const read = (f) => fs.readFileSync(f, 'utf8');
const files = {
  'index.html': read('index.html'),
  'about.html': read('about.html'),
  'services.html': read('services.html'),
  'blog.html': read('blog.html'),
  'favorites.html': read('favorites.html'),
  'login.html': read('login.html'),
  'register.html': read('register.html'),
  'contacts.html': read('contacts.html'),
  'css/style.css': read('css/style.css'),
  'js/script.js': read('js/script.js'),
};
const modDir = path.join('js', 'modules');
fs.readdirSync(modDir)
  .filter((n) => n.endsWith('.js'))
  .forEach((n) => {
    files[path.join('js', 'modules', n).replace(/\\/g, '/')] = read(path.join(modDir, n));
  });
files['js/analytics.js'] = read('js/analytics.js');
files['manifest.webmanifest'] = read('manifest.webmanifest');
const o = {
  wireframe,
  files,
  deploy_instructions,
  tests,
  bug_check,
  optimizations,
};
fs.writeFileSync('site-bundle.json', JSON.stringify(o, null, 2));
console.log('site-bundle.json', fs.statSync('site-bundle.json').size);
