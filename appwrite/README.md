# Appwrite для Print Shop Management

Подготовка **локальной** базы (домашний ПК или VPS). **Firebase в приложении пока не отключается** — здесь только инфраструктура и схема под будущий адаптер.

## Что делает setup

- Создаёт database `print_shop` (или имя из `.env`).
- Создаёт **17 коллекций** с теми же именами, что в Firestore.
- Добавляет атрибуты и индексы (движения, счётчики, email пользователей и т.д.).
- Создаёт документы настроек `AppSettings` (`main`, `materialCatalog`).

Вложенные массивы Firestore (партии FIFO, принтеры в счётчиках, опции принтера) в Appwrite хранятся в полях `*Json` — так же будет читать будущий адаптер.

## 1. Установить Appwrite (Windows, Docker Desktop)

```powershell
cd appwrite
PowerShell -ExecutionPolicy Bypass -File scripts/install-docker.ps1
cd docker
# отредактируйте .env — _APP_DOMAIN=localhost
docker compose up -d
```

Консоль: [http://localhost](http://localhost) → создайте **Project** → **API Keys** → ключ с правами **Databases** (read/write).

> Если Appwrite ругается на HTTPS: для домашней сети часто достаточно `_APP_DOMAIN=localhost` из официального `.env`. Для доступа с других устройств в LAN — свой домен или Tailscale.

## 2. Настроить скрипт

```powershell
cd appwrite
copy .env.example .env
# заполните APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
npm install
npm run setup
```

Проверка без изменений:

```powershell
npm run setup:check
```

После успешного setup появится `generated.env` — **не коммитьте** (в `.gitignore`).

## 3. Фронт (пока не переключаем)

В корне проекта `.env.example`:

- `DATA_BACKEND=firebase` — **оставьте так**, пока не реализованы адаптеры в `src/data/`.
- Когда будете готовы: `DATA_BACKEND=appwrite` + endpoint/project из `generated.env`.

Пересборка / dev-сервер подхватит переменные из `config/build/buildPlugins.ts`.

## 4. Пользователи и роли

В Firebase роли лежат в коллекции `users`. В Appwrite:

1. **Auth** — регистрация/логин (Console или позже из приложения).
2. В коллекции `users` — документ с полями `email`, `role`, `authUserId` (= `$id` из Appwrite Auth).

Скрипт **не** создаёт пользователей — только схему.

## 5. Права доступа

На коллекции выставлены права для **Role.users()** (любой авторизованный). Для продакшена можно ужесточить (teams, labels) — отдельный шаг.

## Структура

```
appwrite/
  schema/collections.mjs   — описание коллекций
  scripts/setup.mjs        — создание в Appwrite
  scripts/install-docker.ps1
  docker/                  — появится после install-docker (compose)
```

Константы для кода: `src/data/appwrite/collectionIds.ts`.

## Связь с Firebase

| Firestore | Appwrite |
|-----------|----------|
| `StockMovements.lots[]` | `lotsJson` |
| `CounterReadings.printers[]` | `printersJson` |
| `Printers.options[]` / `colors[]` | `optionsJson` / `colorsJson` |
| `AppSettings/main` | документ с `settingsKey=main` |
| `AppSettings/materialCatalog` | `settingsKey=materialCatalog`, данные в `catalogJson` |

Миграция данных **не предусмотрена** — новая инсталляция с пустой базой.
