# Подготовка каталога для официального Docker Compose Appwrite (Windows).
# Запуск: PowerShell -ExecutionPolicy Bypass -File scripts/install-docker.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InstallDir = Join-Path $Root "docker"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$ComposeUrl = "https://appwrite.io/install/compose" 
$EnvUrl = "https://appwrite.io/install/env"

Write-Host "Каталог: $InstallDir"
Write-Host "Скачиваю docker-compose.yml ..."
Invoke-WebRequest -Uri $ComposeUrl -OutFile (Join-Path $InstallDir "docker-compose.yml")
Write-Host "Скачиваю .env шаблон ..."
Invoke-WebRequest -Uri $EnvUrl -OutFile (Join-Path $InstallDir ".env")

Write-Host @"

Дальше:
  1. Установите Docker Desktop и включите WSL2 backend.
  2. Отредактируйте $InstallDir\.env — задайте _APP_DOMAIN (например localhost).
  3. cd $InstallDir
     docker compose up -d --remove-orphans
  4. Откройте http://localhost (или ваш домен), создайте project, API key.
  5. cd $Root
     copy .env.example .env
     npm install
     npm run setup

Подробнее: appwrite/README.md
"@
