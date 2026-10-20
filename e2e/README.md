# E2E (Playwright)

## Быстрый старт

```bash
npm run test:e2e
```

Запускает dev-сервер на порту **3000** (если не задан `PLAYWRIGHT_BASE_URL`) и прогоняет E2E-тесты.

**Smoke (Phase 0 responsive):**

```bash
npm run test:e2e:smoke
```

Проекты: `chromium-smoke` (desktop), `mobile-chrome` (Pixel 5), `tablet-chrome` (iPad). Документация: [docs/responsive.md](../docs/responsive.md).

## Авторизованные сценарии

Нужны тестовый пользователь в Firebase Auth и профиль в Firestore (роль с доступом к складу, например `печатник` или `администратор`).

Windows PowerShell:

```powershell
$env:E2E_EMAIL="test@example.com"
$env:E2E_PASSWORD="your-password"
npm run test:e2e
```

Или создайте `.env.e2e.local` (не коммитьте) и подставляйте переменные перед запуском.

При наличии `E2E_EMAIL` и `E2E_PASSWORD` дополнительно выполняются:

- загрузка главной / склада деталей;
- раскрытие панели **Партии (FIFO)**;
- открытие модалки **Приход**.

## Полезные команды

| Команда | Описание |
|---------|----------|
| `npm run test:e2e` | headless прогон (все projects) |
| `npm run test:e2e:smoke` | desktop + mobile + tablet public smoke |
| `npm run test:e2e:mobile` | только phone viewport |
| `npm run test:e2e:tablet` | только tablet viewport |
| `npm run test:e2e:shell` | mobile/tablet drawer (нужны `E2E_EMAIL`, `E2E_PASSWORD`) |
| `npm run test:e2e:stock` | mobile Stock + FIFO (`mobile-authenticated`) |
| `npm run test:e2e:ui` | интерактивный UI Playwright |
| `npm run test:e2e:report` | HTML-отчёт после прогона |

## CI / staging

Укажите уже поднятое приложение:

```bash
set PLAYWRIGHT_BASE_URL=https://your-staging.example
set E2E_EMAIL=...
set E2E_PASSWORD=...
npm run test:e2e
```

## Firebase Emulator (опционально)

В репозитории пока нет `firebase.json`. Для полностью офлайн E2E:

1. `firebase init emulators` (Auth + Firestore).
2. Подключить приложение к эмулятору в dev/test-сборке.
3. Создать seed-данные (детали, партии) и тестового пользователя.

До настройки эмулятора используйте staging или dev-проект Firebase с отдельной тест-учёткой.
