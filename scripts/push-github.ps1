# Push project to https://github.com/IvanovNDTgiek/kc-ozd-site
# Run from project root: .\scripts\push-github.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$git = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $git)) {
    $git = "git"
}

$repoName = "kc-ozd-site"
$remoteUrl = "https://github.com/IvanovNDTgiek/$repoName.git"
$repoUrl = "https://github.com/IvanovNDTgiek/$repoName"

Write-Host "=== GitHub: IvanovNDTgiek / $repoName ===" -ForegroundColor Cyan

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Host "Install GitHub CLI: winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Log in to GitHub (browser will open)..." -ForegroundColor Yellow
    gh auth login -h github.com -p https -w
}

gh repo view "IvanovNDTgiek/$repoName" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating repository $repoName ..." -ForegroundColor Yellow
    gh repo create $repoName --public --source=. --remote=origin --description "KC OZD site - Express + PostgreSQL"
} else {
    Write-Host "Repository exists, configuring remote..." -ForegroundColor Yellow
    & $git remote remove origin 2>$null
    & $git remote add origin $remoteUrl
}

& $git branch -M main
& $git push -u origin main

Write-Host ""
Write-Host "Done: $repoUrl" -ForegroundColor Green
