# Загрузка проекта на https://github.com/IvanovNDTgiek
# Запуск в PowerShell из корня проекта: .\scripts\push-github.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$git = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $git)) {
    $git = "git"
}

$repoName = "kc-ozd-site"
$remoteUrl = "https://github.com/IvanovNDTgiek/$repoName.git"

Write-Host "=== GitHub: IvanovNDTgiek / $repoName ===" -ForegroundColor Cyan

# 1. Вход в GitHub (откроется браузер)
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Host "Установите GitHub CLI: winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Войдите в GitHub (браузер)..." -ForegroundColor Yellow
    gh auth login -h github.com -p https -w
}

# 2. Создать репозиторий (если ещё нет)
$exists = gh repo view "IvanovNDTgiek/$repoName" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Создаю репозиторий $repoName ..." -ForegroundColor Yellow
    gh repo create $repoName --public --source=. --remote=origin --description "Сайт КЦ ОЖД — Express + PostgreSQL"
} else {
    & $git remote remove origin 2>$null
    & $git remote add origin $remoteUrl
}

# 3. Push
& $git branch -M main
& $git push -u origin main

Write-Host ""
Write-Host "Готово: https://github.com/IvanovNDTgiek/$repoName" -ForegroundColor Green
