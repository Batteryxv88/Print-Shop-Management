# Карта миграции Firebase → Appwrite

Приложение на Firebase Hosting пока не переключено. На ноутбуке с Ubuntu уже стоит Appwrite **1.7.4**, пустая база и один пользователь. Этот файл — порядок работ на другом компьютере, где будет переписываться клиент.

Данные Firestore сюда не копировались. Пароли Firebase Auth забрать нельзя: учётки создаются в Appwrite заново.

## Что сделать на другом компьютере

1. Склонировать ветку `develop`.
2. Проверить, что туннель жив, и взять актуальный адрес (см. ниже). Quick Tunnel меняет имя, если процесс перезапускается.
3. В корневой `.env` прописать `DATA_BACKEND=appwrite` и публичные переменные Appwrite. Ключ API во фронт не класть.
4. Добавить браузерный клиент и заменить вызовы Firebase в `src/services/*`, не ломая экраны.
5. Собрать приложение и задеплоить на тот же Firebase Hosting. Хостинг и Analytics остаются.
6. Войти пользователем `mkovalev@prim.offset.loc` (роль `администратор`). Пароль лежит только на ноутбуке, в git его нет.
7. Отдельным заходом перевести `Server/` и `snmp-agent/` — им нужен серверный ключ.

Пока адаптеров нет, в проде оставляйте `DATA_BACKEND=firebase`.

## Эта установка

| | |
|---|---|
| Версия | Appwrite 1.7.4, Traefik 3.6, MariaDB 10.11 |
| Консоль | https://vincent-explosion-agencies-try.trycloudflare.com/console |
| Endpoint для SDK | `https://vincent-explosion-agencies-try.trycloudflare.com/v1` |
| Project ID | `print-shop` |
| Database ID | `print_shop` |
| Пользователь приложения | `mkovalev@prim.offset.loc`, id `admin`, роль `администратор` |

Туннель — Cloudflare Quick Tunnel без своего домена. URL **не переживает перезапуск** `cloudflared`. На ноутбуке unit `appwrite-tunnel.service` (systemd --user) при старте записывает новое имя в `_APP_DOMAIN` и поднимает контейнеры заново. После перезагрузки ноутбука откройте консоль по новому адресу из `~/appwrite-install/runtime/tunnel-url.txt` и поправьте `APPWRITE_ENDPOINT` во фронте.

Стабильное имя: войти через `cloudflared tunnel login`, завести named tunnel на домен в Cloudflare и прописать этот хост в `_APP_DOMAIN`. Пока домена нет, quick tunnel — рабочий, но временный адрес.

Web platforms проекта, с которых браузер имеет право вызывать API:

- `localhost`
- хост туннеля (`vincent-explosion-agencies-try.trycloudflare.com` на момент записи)
- `sl-sandbox-b84b3.web.app`
- `sl-sandbox-b84b3.firebaseapp.com`

Сайт на Firebase Hosting открывается по HTTPS и ходит в Appwrite тоже по HTTPS, поэтому mixed content нет. Если имя туннеля сменилось, в консоли Appwrite добавьте новый hostname платформой типа Web. Иначе браузер получит отказ CORS.

`_APP_OPTIONS_FORCE_HTTPS` на этой машине **выключен**. Traefik принимает туннель по HTTP и подменяет `X-Forwarded-Proto`, а Appwrite 1.7.4 из-за включённого force-https отвечает 301 на тот же URL. Снаружи адрес всё равно `https://`.

## Переменные фронта

В корневой `.env` (не коммитить секреты):

```
DATA_BACKEND=appwrite
APPWRITE_ENDPOINT=https://vincent-explosion-agencies-try.trycloudflare.com/v1
APPWRITE_PROJECT_ID=print-shop
APPWRITE_DATABASE_ID=print_shop
```

`APPWRITE_API_KEY` используется только `appwrite/scripts/setup.mjs` и серверными программами. В webpack-сборку его не подставлять: в браузере достаточно endpoint и project id. Ключ схемы лежит в `appwrite/.env` на ноутбуке.

Сборка уже читает эти имена в `src/config/dataBackend.ts` и `config/build/buildPlugins.ts`.

## Авторизация

Сейчас логин — `signInWithEmailAndPassword` в `src/services/auth.ts`. Саморегистрации нет: администратор заводит человека, затем проверяются коллекция `users` и роль.

Замена:

- вход: `account.createEmailPasswordSession(email, password)`
- выход: `account.deleteSession('current')`
- текущий пользователь: `account.get()` вместо `onAuthStateChanged`
- проверка «есть в `users`» и роль остаются, только чтение идёт в Appwrite
- разрешённые роли те же: `администратор`, `руководитель`, `печатник`, `резчик`, `менеджер`, `дизайнер`
- тексты ошибок перевести с кодов `auth/*` на ответы Appwrite (`user_invalid_credentials`, `401`, сеть)

Нового человека создавать так:

1. Auth-пользователь в проекте `print-shop` (консоль или `POST /v1/users` с серверным ключом `users.write`).
2. Документ в коллекции `users` с тем же `$id`. Поля: `email`, `displayName`, `role`, `createdAt` (миллисекунды), `authUserId` (равен `$id`).

Пароль Firebase в этот документ не переносится.

## Коллекции

Имена 1:1 с Firestore, список в `src/data/appwrite/collectionIds.ts`. База создана скриптом `npm run setup` в каталоге `appwrite/`.

Вложенные массивы и объекты лежат в строках, адаптер делает `JSON.parse` / `JSON.stringify`:

- `StockMovements.lots[]` → `lotsJson`
- `CounterReadings.printers[]` → `printersJson`
- `Printers.options[]` → `optionsJson` (размер поля 20000: на MariaDB строка длиннее 16381 символов хранится как TEXT и не упирается в лимит ширины строки)
- `Printers.colors[]` → `colorsJson`
- `AppSettings/materialCatalog` → документ с `settingsKey=materialCatalog` и `catalogJson`
- `AppSettings/main` → документ с `settingsKey=main`
- `Forms` → `payloadJson`

Идентификатор документа Firestore становится `$id`. Время и даты, которые в Firestore были строками, остаются строками.

Права коллекций: любой вошедший пользователь может читать и писать (`Role.users()`). Это внутреннее приложение цеха, не публичный API. Сузить права можно позже через labels или teams.

На документе Appwrite 1.7 нельзя выдать permission `create`. Создание документа задаётся правом коллекции. Для самого документа — `read`, `update`, `delete`.

## Какие файлы менять

Общий приём: Redux-слайсы и страницы не знают про Firebase. Они вызывают `src/services/*`. Меняется сервис, контракт функций остаётся.

Новый файл `src/data/appwrite/client.ts`: `Client` из `appwrite` (браузерный SDK) с endpoint и project id из `getAppwritePublicConfig()`. Без API key.

`src/shared/lib/firebase/sharedSubscription.ts` оставить как счётчик подписок. Внутри `start()` вместо `onSnapshot` вызывать `client.subscribe` на канал `databases.${databaseId}.collections.${collectionId}.documents`.

Сервисы, которые ходят в Firestore или Auth и которые нужно перевести:

- `src/services/auth.ts` — сессия, как выше
- `src/services/users.ts` — `getDocument` / `listDocuments` с `Query.equal('email', email)` / `createDocument` / `updateDocument`. `setDoc` с merge — это `updateDocument`, а если документа нет, `createDocument`
- `src/services/firebase.ts` — при `DATA_BACKEND=appwrite` не вызывать `getFirestore` и `getAuth`. Analytics можно оставить только для сборки Firebase
- `src/services/appSettings.ts` — документ `AppSettings`, где `settingsKey` равен `main` или `materialCatalog`
- `src/services/printers.ts`
- `src/services/parts.ts`
- `src/services/toners.ts`
- `src/services/tonerHistory.ts`
- `src/services/usedParts.ts`
- `src/services/materials.ts`
- `src/services/laminations.ts`
- `src/services/holdersAndKnifes.ts`
- `src/services/stockAccounting.ts`
- `src/services/counterReadings.ts`
- `src/services/materialUsage.ts`
- `src/services/materialCatalog.ts`
- `src/services/quantityToOrder.ts`
- `src/services/inventorySessions.ts`
- `src/services/adminUtils.ts`
- `src/services/seedTestCounterReadings.ts` — тестовые данные, тоже через адаптер либо не запускать на Appwrite

Соответствие вызовов:

- `getDocs` / `getDoc` → `listDocuments` / `getDocument`
- `addDoc` / `setDoc` → `createDocument` (свой `$id`, если id был задан)
- `updateDoc` → `updateDocument`
- `deleteDoc` → `deleteDocument`
- `query` + `where` + `orderBy` → `Query.equal`, `Query.orderDesc` и лимит
- `onSnapshot` → Realtime-подписка, наружу по-прежнему отдавать массив документов

`src/contexts/AuthContext.tsx` должен брать пользователя из новой `auth.ts`, не из типа `User` Firebase.

`src/app/providers/FirebaseDataProvider/index.tsx` по-прежнему только диспатчит `loadAppSettings`. Достаточно, чтобы `appSettings.ts` читал Appwrite.

Часть слайсов и экранов импортирует `firebase/*` напрямую, их тоже перевести на сервисы:

- `src/app/providers/StoreProvider/Store/CounterReadingSlice.ts`
- `src/app/providers/StoreProvider/Store/HoldersAndKnifesSlice.ts`
- `src/app/providers/StoreProvider/Store/LaminationsSlice.ts`
- `src/app/providers/StoreProvider/Store/MaterialsSlice.ts`
- `src/app/providers/StoreProvider/Store/PartSlice.ts`
- `src/app/providers/StoreProvider/Store/ReplacedPartSlice.ts`
- `src/app/providers/StoreProvider/Store/RotationFormsSlice.ts`
- `src/app/providers/StoreProvider/Store/TonerSlice.ts`
- `src/app/providers/StoreProvider/Store/TonersStorageSlice.ts`
- `src/pages/AdminMainComponent.tsx`
- `src/shared/ui/EditReportPart/EditReportPart.tsx`

`src/telegramBot.js` тоже читает Firestore. Перевести вместе с сервисами либо оставить на Firebase, пока бот не нужен на новом бэкенде.

## Что не входит в переписывание фронта

Эти места всё ещё пишут в Firestore. Им нужен серверный ключ (`users.read` не обязателен, нужны `databases.read` и `databases.write`), не ключ из браузера:

- `Server/app/sync/sl_firestore.py` и `Server/app/sync/firestore_stub.py`
- `snmp-agent/src/firestore.js`
- `e2e/auth.setup.ts` — логин тестового пользователя через сессию Appwrite

## Поднять такой же Appwrite на другом сервере

На Ubuntu с Docker:

```bash
cd appwrite
./scripts/install-ubuntu.sh --domain appwrite.example.com --dir "$HOME/appwrite"
```

Скрипт копирует `appwrite/docker/docker-compose.yml` (образы `appwrite/appwrite:1.7.4` и `traefik:3.6`), генерирует секреты из `appwrite/docker/.env.example` и делает `docker compose up -d`. Повторный запуск не затирает уже созданный `.env`, только обновляет домен.

Дальше с машины, где есть Node 20:

```bash
cd appwrite
cp .env.example .env
# вписать endpoint, project id и ключ с правами databases.* / collections.* / attributes.* / indexes.* / documents.*
npm install
npm run setup
```

Проект и ключ можно создать скриптом `npm run bootstrap` (учётные данные консоли передать через env или `--credentials`, файл в git не класть).

Не ставьте `latest` и не перескакивайте на Appwrite 2.x на машине с 8 ГБ RAM: там другой движок базы, а эта схема и скрипт проверены на 1.7.4. Для 8 ГБ в `.env` стоит `_APP_WORKER_PER_CORE=1`.

Проверка после установки:

```bash
curl -H "Host: ВАШ_ДОМЕН" http://127.0.0.1/v1/health/version
```

Ответ: `{"version":"1.7.4"}`.
