# Сайт КЦ ОЖД

Корпоративный сайт: статические HTML-страницы, Express API, PostgreSQL (Supabase).

## Быстрый старт

```bash
cp .env.example .env
# Укажите DATABASE_URL из Supabase
npm install
npm run server
```

Откройте http://127.0.0.1:3000/

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run server` | Запуск сервера |
| `npm run db:test` | Проверка подключения к БД |
| `npm run db:list` | Последние заявки |
| `npm run site:url` | Подставить домен в SEO (`SITE_URL`) |

## Деплой

Подробно: [DEPLOY.md](./DEPLOY.md) (Vercel, Railway, VPS).

Переменные окружения — [.env.example](./.env.example). Файл `.env` в репозиторий не попадает.
