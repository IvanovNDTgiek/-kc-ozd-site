@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === KC OZD server (LAN: HOST=0.0.0.0 по умолчанию) ===
echo Current dir: %CD%
where node >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден в PATH. Установите LTS с https://nodejs.org
  pause
  exit /b 1
)
if not exist "package.json" (
  echo [ОШИБКА] package.json не найден. Запускайте bat из папки проекта d:\gay
  pause
  exit /b 1
)
if not exist "node_modules\pg" (
  echo Устанавливаю зависимости ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [ОШИБКА] npm install завершился с ошибкой.
    pause
    exit /b 1
  )
)
if not exist ".env" (
  echo [ВНИМАНИЕ] Файл .env не найден. Скопируйте .env.example в .env
  echo и задайте DATABASE_URL ^(PostgreSQL^).
  echo Локально: docker compose up -d db
  echo.
  copy /Y .env.example .env >nul 2>&1
)
call npm run server
echo.
echo Сервер остановлен (код %ERRORLEVEL%^).
pause
