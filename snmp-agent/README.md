# SL SNMP Counter Agent (Windows)

Локальный агент для типографии: по SNMP снимает счётчики с принтеров и пишет их в Firestore в ту же коллекцию `CounterReadings`, что использует веб‑журнал учёта.

Браузер SNMP не умеет — поэтому агент крутится на Windows‑ПК в той же сети, что и машины.

## Что делает

1. Читает `AppSettings/main.counterReadingDay` (день из админки).
2. Если наступил срок и за период ещё нет записи — опрашивает принтеры с заполненным **IP**.
3. Пишет документ `CounterReadings/{YYYY-MM}` с автором «SNMP-агент».
4. Если запись уже есть — ничего не перезаписывает (правку делайте в журнале учёта).

Ежедневный запуск через Планировщик заданий Windows. Логика «пора / ещё рано» такая же, как в веб‑напоминалке.

## Требования

- Windows 10/11
- [Node.js 18+](https://nodejs.org)
- Принтеры в локальной сети, SNMP включён (обычно community `public` или свой)
- IP принтеров заполнены в **Администрирование → Редактор переменных**
- День снятия задан в админке
- JSON ключ сервисного аккаунта Firebase

## Установка (один раз)

### 1. Сервисный аккаунт Firebase

1. [Firebase Console](https://console.firebase.google.com) → ваш проект  
2. Project settings → **Service accounts**  
3. **Generate new private key** → скачается JSON  
4. Положите файл в папку агента как `serviceAccountKey.json`

В Firestore Rules для Admin SDK правила обходятся — агент пишет от имени сервисного аккаунта. Не публикуйте этот файл и не коммитьте в git.

### 2. Конфиг

```powershell
cd C:\path\to\SL\snmp-agent
copy config.example.json config.json
npm install
```

В `config.json` при необходимости поправьте:

- `snmp.community` — строка community (по умолчанию `public`)
- `schedule.runHour` / `runMinute` — во сколько Планировщик будет будить агент
- `profiles` — OID счётчиков по модели принтера

### 3. Проверка SNMP без записи

```powershell
npm run dry-run
```

В консоли и в `logs\YYYY-MM-DD.log` будет видно, кто ответил и какие цифры пришли.

### 4. Планировщик Windows

От имени администратора:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-task.ps1
```

Создаётся задание `SL-SNMP-Counter-Agent` (ежедневно в час из `config.json`).

Удалить:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-task.ps1
```

Ручной запуск задания: `schtasks /Run /TN SL-SNMP-Counter-Agent`

Принудительно сейчас (с записью, если за месяц ещё пусто):

```powershell
npm run once
```

## OID (профили)

По умолчанию используется стандартный Printer-MIB:

| Поле  | OID (default)              | Смысл                          |
|-------|----------------------------|--------------------------------|
| total | `1.3.6.1.2.1.43.10.2.1.4.1.1` | `prtMarkerLifeCount` — общий |

У Konica/Accurio/Label mono и color часто на **вендорных** OID. Их нужно подобрать один раз (MIB браузер или документация) и прописать в `config.profiles` по имени **модели** из справочника принтеров:

```json
"C71cf": {
  "total": "1.3.6.1.2.1.43.10.2.1.4.1.1",
  "mono": "1.3.6.1.4.1.xxxx...",
  "color": "1.3.6.1.4.1.xxxx..."
}
```

Если mono/color не заданы — агент сохранит только `total` и напишет предупреждение в лог. В журнале учёта запись можно поправить вручную.

## Команды

| Команда | Действие |
|---------|----------|
| `node src/index.js` | Штатный ежедневный прогон (день из AppSettings) |
| `node src/index.js --force` | Опрос за текущий месяц сейчас |
| `node src/index.js --force --dry-run` | Только опрос, без Firestore |
| `npm run dry-run` | То же, что dry-run выше |

Коды выхода: `0` — ок, `1` — фатальная ошибка, `2` — частично (часть принтеров не ответила, но запись создана).

## Связь с веб‑приложением

- Читает: `Printers`, `AppSettings/main`
- Пишет: `CounterReadings/{periodKey}` в том же формате, что кнопка «Сохранить показания»
- Напоминалка в навбаре гаснет, когда период записан
- Уже существующую запись агент **не затирает**

## Типовые проблемы

| Симптом | Что проверить |
|---------|----------------|
| `Нет config.json` | Скопировать example |
| `serviceAccountKey не найден` | JSON ключ рядом с агентом |
| `Нет принтеров с IP` | IP в редакторе переменных |
| `Ещё рано` | День в админке / календарь |
| Timeout / noResponse | SNMP на принтере, community, пинг IP, UDP 161 |
| Только total | Добавить mono/color OID в профиль модели |
