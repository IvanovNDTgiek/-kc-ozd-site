# Сайт КЦ ОЖД

Корпоративный сайт: статические HTML-страницы, Express API, PostgreSQL (облако или Docker).

## Быстрый старт

```bash
cp .env.example .env
# Укажите DATABASE_URL (Neon, Supabase, Railway или docker compose up -d db)
npm install
npm run server
```

Откройте http://127.0.0.1:3000/

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run server` | Запуск сервера |
| `npm run db:list` | Последние заявки из БД |
| `npm run site:url` | Подставить домен в canonical/sitemap (`SITE_URL`) |
| `npm test` | Тесты валидации |

## Деплой на домен

Подробно: [DEPLOY.md](./DEPLOY.md)

## Переменные окружения

См. [.env.example](./.env.example). Файл `.env` в репозиторий не попадает.
