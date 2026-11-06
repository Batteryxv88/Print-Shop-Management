# Сбор счётчиков принтеров (SNMP)

Desktop-приложение на Python для опроса профессиональных принтеров (**Konica Minolta Accurio**, **Ricoh Pro** и др.) по SNMP, локального хранения в SQLite и подготовки синхронизации с **Cloud Firestore**.

## Сборка .exe (Windows)

Дважды щёлкните [`build.bat`](build.bat) или в PowerShell:

```powershell
cd Server
.\build.bat
```

Готовый файл: `dist\PrinterCounterCollector\PrinterCounterCollector.exe`  
Рядом создаётся папка `data\` для `config.yaml` и `collector.db` (настройки и база сохраняются между запусками).

При ошибке запуска соберите с консолью для диагностики:

```powershell
pyinstaller --noconfirm --console PrinterCounterCollector.spec
```

## Быстрый старт (Windows)

```powershell
cd Server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Конфигурация: [`data/config.yaml`](data/config.yaml) (создаётся из [`config.example.yaml`](config.example.yaml)).  
База данных: `data/collector.db`.

## Возможности

- Добавление принтеров по IP, выбор профиля OID (Konica Minolta / Ricoh / Generic)
- Community SNMP на каждый принтер + значения по умолчанию в настройках
- Ручной сбор и автоматическое расписание: **каждый день** или **1-е число месяца**
- История снимков, экспорт CSV
- **Узлы (барабаны, ролики)**: SNMP walk по Printer-MIB с фильтром в YAML (`component_filter` — без тонера/скрепок); секция «Узлы» в истории
- **Редактирование принтеров**: IP, профиль OID, community, вкл/выкл сбора
- Синхронизация с SL: загрузка `Printers`, отправка `CounterReadings/{YYYY-MM}`

## SNMP на принтере

1. Включите SNMP v2c в веб-интерфейсе / панели устройства.
2. Задайте **community** (не обязательно `public`).
3. Убедитесь, что с ПК доступен UDP **161** до IP принтера.
4. В приложении: «Проверить SNMP» — сверьте счётчики с экраном принтера.

Профили OID лежат в [`app/snmp/profiles/`](app/snmp/profiles/). При расхождении на конкретной модели отредактируйте YAML или сделайте `snmpwalk` и подберите OID.

### Пример проверки (если установлен Net-SNMP)

```powershell
snmpget -v2c -c YOUR_COMMUNITY 192.168.1.50 1.3.6.1.2.1.1.5.0
```

## Интеграция с SL (Firebase / Firestore)

Desktop-приложение подключается к тому же проекту Firebase, что и веб **Print Shop Management**:

| Firestore | Назначение |
|-----------|------------|
| `Printers/{id}` | IP и имя правятся в веб-админке SL |
| `CounterReadings/{YYYY-MM}` | месячные показания (массив `printers[]`) |
| `AppSettings/main` | `counterReadingDay` — день снятия |

**Настройки:** `project_id` (например `sl-sandbox-b84b3`), путь к **service account JSON**, `agent_user_id` / `agent_user_name`.

**Рабочий процесс:**

1. В SL задайте IP принтеров и день снятия.
2. В desktop: «Загрузить из Firestore» на вкладке «Принтеры».
3. SNMP-снимки копятся локально в SQLite.
4. «Отправить показания за период» (или автоматически после месячного сбора) создаёт документ `CounterReadings/{periodKey}`, если его ещё нет.

Прежний Node-агент [`snmp-agent`](../snmp-agent) можно не запускать: его роль выполняет это приложение.

Маппинг счётчиков: локальные `black` → SL `mono`, `color` → `color`, `total` → `total`.

## Локальный тест без принтера (SNMP simulator)

Можно проверить логику опроса на симуляторе [snmpsim](https://github.com/etingof/snmpsim):

```powershell
pip install snmpsim
# Запустите симулятор с записью .snrec на UDP 161 (от администратора или другой порт)
python -m snmpsim.command.responder --data-dir=./snmpsim-data --agent-udpv4-endpoint=127.0.0.1:1161
```

В приложении добавьте принтер с IP симулятора (порт 161 или тот, на котором слушает snmpsim). Для отладки OID добавьте свои значения в YAML-профили.

## Тесты

```powershell
python -m unittest discover -s tests -v
```

## Структура

```
app/
  snmp/          # клиент SNMP и YAML-профили
  storage/       # SQLite
  services/      # сборщик
  scheduler/     # APScheduler
  sync/          # LocalOnly + Firestore SL backend
  gui/           # CustomTkinter
```
