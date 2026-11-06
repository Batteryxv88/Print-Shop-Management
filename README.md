# Print Shop Management

Внутренняя система учёта для типографии (этикетка / цифровая печать): склад расходников, журнал обслуживания принтеров, счётчики, аналитика затрат и цеховые инструменты.

Стек: **React + TypeScript + Redux Toolkit + Firebase (Firestore/Auth)** + опциональный **Appwrite (self-hosted, в подготовке)** + **Windows-приложение сбора счётчиков по SNMP** ([`Server/`](./Server)).

---

## Возможности

### Склад
- Детали по моделям и секциям, тонеры, бумага (лист/рулон), ламинация, держатели/лезвия
- Приход с ценой, поставщиком и подсказками из базы
- Списание по **FIFO** (партии `StockLots`, движения `StockMovements`)
- Список «под заказ» и выгрузка в Excel

### Журнал учёта
- Замена тонера и деталей (ресурс, %)
- Списание бумаги и ламинации
- Расходы на сервисного инженера (привязка к принтеру)
- Ввод счётчиков по месяцам с историей и правкой
- Напоминание в навбаре, когда пора снять показания

### Аналитика
- Закуплено / потрачено / остаток по периоду
- Графики объёма печати и затрат за год
- Карточка принтера: ₽/клик, тонеры в штуках, замены, категории затрат
- Отдельный блок по бумаге и ламинации
- Экспорт в Excel с графиками

### Администрирование
- Пользователи и роли (администратор, руководитель, печатник, дизайнер, резчик, менеджер)
- Справочник принтеров (IP, цвета, опции, загрузка деталей из Excel)
- День снятия счётчиков
- Включение складов бумаги/ламинации и справочники свойств

### Цех
- Калькулятор длины/толщины рулона и ламинации
- Ротация (раскладка этикетки)
- Поиск сервисных кодов ошибок по машинам

### Сбор счётчиков по SNMP (Windows)
Папка [`Server/`](./Server) — desktop-приложение **PrinterCounterCollector**: опрашивает принтеры по SNMP, хранит снимки локально и отправляет показания в Firestore (`CounterReadings`). Подробности в [`Server/README.md`](./Server/README.md).

Папка [`snmp-agent/`](./snmp-agent) — прежний Node-агент. Для ежедневного сбора его запускать не нужно.

---

## Быстрый старт (веб)

### Требования
- Node.js 18+
- Проект Firebase (Firestore + Authentication)

### Установка

```bash
npm install
```

Укажите конфиг Firebase в `src/services/firebase.ts` (apiKey, projectId и т.д.).

Скопируйте `.env.example` → `.env` в корне. По умолчанию `DATA_BACKEND=firebase` — менять не нужно.

### Appwrite (локально, без отказа от Firebase)

Схема БД и скрипт установки: [`appwrite/README.md`](./appwrite/README.md). Приложение **пока** ходит только в Firebase; Appwrite — для домашней/VPS-песочницы.

### Запуск

```bash
npm start
```

Откроется dev-сервер на [http://localhost:3000](http://localhost:3000).

### Сборка

```bash
npm run build:prod
```

Готовые файлы — в папке `build/`.

### Публикация

| Площадка | URL (пример) | Сборка | Команда |
|----------|--------------|--------|---------|
| GitHub Pages | `https://batteryxv88.github.io/Print-Shop-Management/` | `PUBLIC_PATH=/Print-Shop-Management/` | `npm run deploy` |
| Firebase Hosting | `https://sl-sandbox-b84b3.web.app` | `PUBLIC_PATH=/` | `npm run deploy:firebase` |

**Firebase Hosting (локально):**

1. Один раз: `npm install`, затем `npx firebase login` (CLI из `firebase-tools`).
2. В [Firebase Console](https://console.firebase.google.com) → **Build → Hosting** включите Hosting для проекта `sl-sandbox-b84b3`.
3. **Authentication → Settings → Authorized domains** — добавьте `sl-sandbox-b84b3.web.app` и `sl-sandbox-b84b3.firebaseapp.com` (GitHub Pages домен оставьте, если нужен).
4. `npm run deploy:firebase`

**CI:** workflow [`.github/workflows/deploy-firebase-hosting.yml`](./.github/workflows/deploy-firebase-hosting.yml) — секрет репозитория `FIREBASE_SERVICE_ACCOUNT` (JSON сервисного аккаунта с правом деплоя Hosting). Без секрета job упадёт; локальный деплой не требует секрета.

---

## Роли

| Роль | Доступ |
|------|--------|
| Администратор | Всё + админка |
| Руководитель | Склад, журнал, аналитика |
| Печатник | Склад, журнал |
| Дизайнер / менеджер / резчик | Ограниченные разделы склада и общие инструменты |

Создание пользователей — в **Администрирование**.

---

## Структура проекта

```
src/
  app/           # провайдеры, store, роутинг
  pages/         # страницы (склад, журнал, аналитика, …)
  widgets/       # крупные блоки UI
  features/      # формы действий (приход, замена, …)
  services/      # Firebase / бизнес-логика (активный бэкенд)
  data/          # будущие адаптеры Appwrite
  config/        # DATA_BACKEND и т.п.
  shared/        # UI-киты, утилиты, стили
appwrite/        # Docker + npm run setup (коллекции под Firestore)
Server/          # Windows-приложение сбора счётчиков по SNMP
snmp-agent/      # прежний Node-агент, для ежедневного сбора не используется
```

---

## Сбор счётчиков (кратко)

Приложение лежит в [`Server/`](./Server).

1. Заполните **IP** принтеров в админке (**Принтеры**).
2. Задайте **день снятия** счётчиков.
3. Скачайте service account JSON из Firebase и укажите путь к нему в настройках приложения. Файл не коммитьте.
4. Из `Server`: `python -m venv .venv`, затем `pip install -r requirements.txt` и `python run.py`.
5. На вкладке «Принтеры» загрузите список из Firestore и проверьте SNMP.

Сборка exe: `Server/build.bat`. Готовый файл появляется в `dist/` и в git не входит.

---

## Полезные команды

| Команда | Описание |
|---------|----------|
| `npm start` | Dev-сервер |
| `npm run build:prod` | Продакшен-сборка (путь как для GitHub Pages по умолчанию) |
| `npm run build:pages` | Сборка под GitHub Pages |
| `npm run build:firebase` | Сборка под Firebase Hosting (`/`) |
| `npm run deploy:firebase` | Сборка + `firebase deploy --only hosting` |
| `npm run build:dev` | Dev-сборка |
| `cd Server && python run.py` | Сборщик счётчиков по SNMP |

---

## Безопасность

- Клиентский конфиг Firebase в репозитории — нормальная практика для веб-приложений; доступ ограничивайте **Firestore Security Rules** и Auth.
- Ключ сервисного аккаунта сборщика — секрет, только на ПК в цехе.
- Файл `.env` (если используете) не должен содержать приватные ключи.

---

## Лицензия

ISC — для внутреннего использования типографии.
