# Деплой сайта КЦ ОЖД на домен с облачной PostgreSQL

Репозиторий: https://github.com/IvanovNDTgiek/kc-ozd-site (после первой загрузки — см. `scripts/push-github.ps1`).

Сайт — один Node.js‑процесс (Express): статические HTML/CSS/JS и API (`/api/contact`, `/api/auth/*`). Данные хранятся в **PostgreSQL** (облако или свой сервер).

## 1. Облачная база данных

Выберите один вариант (все дают connection string `postgresql://...`):

| Сервис | Бесплатный tier | Примечание |
|--------|-----------------|------------|
| [Neon](https://neon.tech) | Да | Удобно для старта, SSL по умолчанию |
| [Supabase](https://supabase.com) | Да | Postgres + панель |
| [Railway](https://railway.app) | Ограниченно | Можно и БД, и приложение в одном месте |

В панели создайте проект → **Connection string** → скопируйте URL.

В `.env` на сервере:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
DATABASE_SSL=true
NODE_ENV=production
TRUST_PROXY=true
COOKIE_SECURE=true
SITE_URL=https://ваш-домен.ru
PORT=3000
```

Для Neon/Supabase обычно нужен `DATABASE_SSL=true`.

Схема таблиц создаётся автоматически при первом запуске (`server/db.js`).

### Перенос со старого SQLite

Если есть `data/contacts.db`:

```bash
set DATABASE_URL=postgresql://...
npm run db:migrate-sqlite
```

## 2. Локальная разработка (Docker Postgres)

```bash
copy .env.example .env
docker compose up -d db
npm install
npm run server
```

Откройте http://127.0.0.1:3000/

## 3. Публикация на домен

### Вариант A — VPS (рекомендуется для своего домена)

1. Сервер с Ubuntu, установите Docker.
2. Склонируйте репозиторий, создайте `.env` с `DATABASE_URL` (облачная БД) или поднимите `docker compose up -d`.
3. Подставьте домен в SEO:

   ```bash
   set SITE_URL=https://ваш-домен.ru
   npm run site:url
   ```

4. Запуск приложения:

   ```bash
   docker compose up -d --build
   ```

   Или без Docker: `npm ci --omit=dev` и `npm start` (нужен Node 20+).

5. **Nginx** перед приложением (пример — `deploy/nginx.conf.example`):

   - `your-domain.ru` → `proxy_pass http://127.0.0.1:3000`
   - SSL: `certbot --nginx -d your-domain.ru`

6. В DNS у регистратора домена: **A‑запись** `@` и `www` → IP вашего VPS.

### Вариант B — Vercel (публичная ссылка за несколько минут)

Подходит этому проекту: в репозитории есть `vercel.json` и `api/index.js` (Express как serverless + Supabase).

1. Зарегистрируйтесь на [vercel.com](https://vercel.com) → **Add New Project** → Import GitHub → `IvanovNDTgiek/kc-ozd-site`.
2. **Framework Preset:** Other (не Next.js).
3. **Environment Variables** (как в `.env`, без файла `.env`):

   | Имя | Значение |
   |-----|----------|
   | `DATABASE_URL` | строка из Supabase (pooler, :6543) |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` |
   | `NODE_ENV` | `production` |
   | `TRUST_PROXY` | `true` |
   | `COOKIE_SECURE` | `true` |

4. **Deploy** → получите ссылку вида `https://kc-ozd-site.vercel.app`.
5. Проверка: `https://ВАШ-ПРОЕКТ.vercel.app/api/health` → `{"ok":true,"db":true}`.
6. Свой домен: Vercel → Project → **Settings** → **Domains** → добавить домен → DNS по инструкции Vercel.
7. После появления домена: `SITE_URL=https://ваш-домен.ru` в Vercel env и локально `npm run site:url` + push в Git.

**Ограничения Vercel:** холодный старт 1–3 с на бесплатном тарифе; для тяжёлого трафика удобнее Railway/Render (вариант C).

### Вариант C — Railway / Render

1. Подключите GitHub‑репозиторий.
2. Build: `npm ci`
3. Start: `npm start` (читает `Procfile`).
4. Переменные окружения: `DATABASE_URL`, `NODE_ENV=production`, `SITE_URL`, `TRUST_PROXY=true`, `COOKIE_SECURE=true`, `DATABASE_SSL=true`.
5. В настройках сервиса привяжите **Custom Domain** → добавьте CNAME у регистратора, как указано в панели.

### Вариант C — только статика (без формы и входа)

GitHub Pages / Netlify отдают HTML, но **форма и регистрация не работают** без API. Для полного сайта нужен вариант A или B.

## 4. Проверка после деплоя

- https://ваш-домен.ru/ — главная
- https://ваш-домен.ru/api/health — `{"ok":true,"db":true}`
- Форма на `/contacts.html` — отправка и запись в БД
- `npm run db:list` — последние заявки (с `DATABASE_URL` на машине админа)

## 5. Переменные окружения

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `DATABASE_URL` | Да | Строка PostgreSQL |
| `DATABASE_SSL` | Облако | `true` для Neon/Supabase |
| `SITE_URL` | Для SEO | Без `/` в конце |
| `NODE_ENV` | Прод | `production` |
| `TRUST_PROXY` | За nginx | `true` |
| `COOKIE_SECURE` | HTTPS | `true` |
| `PORT` | Нет | По умолчанию 3000 |

Полный список — `.env.example`.
