#!/usr/bin/env node
/**
 * SL SNMP Counter Agent
 *
 * Ежедневный запуск (Планировщик заданий Windows):
 *   node src/index.js
 *
 * Принудительно сейчас:
 *   node src/index.js --force
 *
 * Только опрос, без записи в Firestore:
 *   node src/index.js --force --dry-run
 */

const { loadConfig, resolveProfile } = require('./config');
const {
    initFirestore,
    fetchPrinters,
    resolvePeriodToCollect,
    createCounterReading,
} = require('./firestore');
const { pollPrinter } = require('./snmp');
const { log } = require('./log');

const parseArgs = (argv) => ({
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    help: argv.includes('--help') || argv.includes('-h'),
});

const buildEntry = (printer, values) => {
    const colorMode = printer.colorMode === 'bw' ? 'bw' : 'color';
    const entry = {
        printerId: printer.id,
        printerName: printer.name,
        colorMode,
        values: { total: Number(values.total) || 0 },
    };
    if (colorMode === 'color') {
        if (values.mono != null) entry.values.mono = Number(values.mono) || 0;
        if (values.color != null) entry.values.color = Number(values.color) || 0;
        // Спец. цвета (W и т.п.) — если появятся OID в профиле special:<code>
        if (values.special && typeof values.special === 'object') {
            entry.values.special = { ...values.special };
        }
    }
    return entry;
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        // eslint-disable-next-line no-console
        console.log(`Usage:
  node src/index.js              # снять, если наступил день из AppSettings
  node src/index.js --force      # снять за текущий месяц сейчас
  node src/index.js --force --dry-run
`);
        process.exit(0);
    }

    log.info('Старт SNMP-агента', {
        force: args.force,
        dryRun: args.dryRun,
    });

    const config = loadConfig();
    initFirestore(config.serviceAccountPath);

    const plan = await resolvePeriodToCollect(args.force);
    log.info('План снятия', {
        periodKey: plan.periodKey,
        counterReadingDay: plan.counterReadingDay,
        reason: plan.reason,
    });

    if (plan.reason === 'no-day') {
        log.warn(
            'В AppSettings не задан counterReadingDay — агент ничего не делает. Укажите день в админке.'
        );
        process.exit(0);
    }

    if (plan.reason === 'too-early') {
        log.info(
            `Ещё рано: день снятия ${plan.counterReadingDay}, активный период пока не наступил.`
        );
        process.exit(0);
    }

    if (plan.reason === 'already-done' && !args.force) {
        log.info(
            `Показания за ${plan.periodKey} уже внесены — повторный опрос не нужен.`
        );
        process.exit(0);
    }

    if (plan.reason === 'already-done' && args.force) {
        log.warn(
            `За ${plan.periodKey} запись уже есть. --force не перезаписывает (откройте правку в журнале учёта). Продолжаю только dry-run опрос.`
        );
        args.dryRun = true;
    }

    const printers = await fetchPrinters();
    const withIp = printers.filter((p) => p.ip);
    const withoutIp = printers.filter((p) => !p.ip);

    if (withoutIp.length) {
        log.warn(
            'Принтеры без IP пропущены',
            withoutIp.map((p) => p.name)
        );
    }
    if (withIp.length === 0) {
        log.error(
            'Нет принтеров с IP. Заполните IP в Администрирование → Редактор переменных.'
        );
        process.exit(1);
    }

    const entries = [];
    const failures = [];

    for (const printer of withIp) {
        const profile = resolveProfile(config, printer.model);
        if (!profile.total) {
            failures.push({
                name: printer.name,
                error: 'В профиле нет OID total',
            });
            log.error(`${printer.name} (${printer.ip}): нет OID total`);
            continue;
        }

        try {
            log.info(`Опрос ${printer.name} @ ${printer.ip}…`);
            const { values, raw } = await pollPrinter(
                printer.ip,
                profile,
                config.snmp
            );
            log.info(`OK ${printer.name}`, raw);

            if (
                printer.colorMode !== 'bw' &&
                (values.mono == null || values.color == null)
            ) {
                log.warn(
                    `${printer.name}: нет mono/color OID — сохранён только total. Добавьте OID в config.profiles.`
                );
            }

            entries.push(buildEntry(printer, values));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failures.push({ name: printer.name, ip: printer.ip, error: message });
            log.error(`FAIL ${printer.name} @ ${printer.ip}: ${message}`);
        }
    }

    if (entries.length === 0) {
        log.error('Ни один принтер не ответил — в Firestore ничего не пишем.');
        process.exit(1);
    }

    if (failures.length) {
        log.warn(
            `Снято ${entries.length}, ошибок ${failures.length}. Запись будет частичной.`
        );
    }

    if (args.dryRun) {
        log.info('DRY-RUN: запись в Firestore пропущена', {
            periodKey: plan.periodKey,
            printers: entries.map((e) => ({
                name: e.printerName,
                values: e.values,
            })),
        });
        process.exit(failures.length ? 2 : 0);
    }

    const noteParts = [
        'Автоснятие по SNMP',
        failures.length
            ? `ошибки: ${failures.map((f) => f.name).join(', ')}`
            : null,
    ].filter(Boolean);

    await createCounterReading({
        periodKey: plan.periodKey,
        printers: entries,
        userId: config.agent.userId,
        userName: config.agent.userName,
        note: noteParts.join('. '),
    });

    log.info(
        `Записано в CounterReadings/${plan.periodKey}: ${entries.length} принтер(ов).`
    );
    process.exit(failures.length ? 2 : 0);
};

main().catch((err) => {
    log.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
});
