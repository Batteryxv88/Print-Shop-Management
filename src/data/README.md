# Слой данных (Firebase + Appwrite)

Сейчас приложение работает **только через Firebase** (`src/services/*`).

Здесь появятся адаптеры Appwrite с теми же контрактами. Переключение — `DATA_BACKEND` в `.env` (см. `.env.example` в корне).

Схема коллекций и установка сервера: [`../../appwrite/README.md`](../../appwrite/README.md). Что менять во фронте: [`../../docs/APPWRITE_MIGRATION.md`](../../docs/APPWRITE_MIGRATION.md).
