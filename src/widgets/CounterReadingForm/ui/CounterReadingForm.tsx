import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    useAppDispatch,
    useAppSelector,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { completeCounterReading } from '../../../app/providers/StoreProvider/Store/CounterReadingSlice';
import {
    fetchAllCounterReadings,
    type CounterReadingPrinterEntry,
    type CounterReadingRecord,
} from '../../../services/counterReadings';
import {
    emptyValuesFromFields,
    getCounterFieldsForPrinter,
    getFieldValue,
    setFieldValue,
    type CounterFieldKey,
    type PrinterCounterValues,
} from '../../../shared/lib/counterReading/fields';
import {
    formatLifeWithCommas,
    parseLifeExact,
} from '../../../shared/lib/formatLifeInput';
import {
    formatPeriodLabel,
    getActivePeriodKey,
    getOverdueDays,
    pad2,
} from '../../../shared/lib/utils/counterReading';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import cls from './CounterReadingForm.module.scss';

type DraftMap = Record<string, PrinterCounterValues>;

const currentPeriodKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU');
};

/** Значения записи по id принтера (fallback — по имени для старых записей) */
const valuesByPrinter = (
    record: CounterReadingRecord | undefined,
    printerId: string,
    printerName: string
): PrinterCounterValues | undefined => {
    if (!record) return undefined;
    const entry =
        record.printers.find((e) => e.printerId === printerId) ||
        record.printers.find((e) => e.printerName === printerName);
    return entry?.values;
};

const CounterReadingForm = () => {
    const dispatch = useAppDispatch();
    const { printers, isLoading: printersLoading } = usePrinters();
    const { counterReadingDay, saving } = useAppSelector(
        (state) => state.counterReading
    );

    const activePeriod = getActivePeriodKey(counterReadingDay);
    const maxPeriod = currentPeriodKey();

    const [periodKey, setPeriodKey] = useState(activePeriod || maxPeriod);
    const [records, setRecords] = useState<CounterReadingRecord[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(true);
    const [drafts, setDrafts] = useState<DraftMap>({});
    const [error, setError] = useState('');
    const [okOpen, setOkOpen] = useState(false);
    const [okMessage, setOkMessage] = useState('');
    /** Правка уже внесённых показаний (по кнопке «Изменить») */
    const [editing, setEditing] = useState(false);

    const sortedPrinters = useMemo(
        () => [...printers].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [printers]
    );

    const loadRecords = useCallback(async () => {
        setRecordsLoading(true);
        try {
            setRecords(await fetchAllCounterReadings());
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось загрузить показания'
            );
        } finally {
            setRecordsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const current = useMemo(
        () => records.find((r) => r.periodKey === periodKey),
        [records, periodKey]
    );
    const previous = useMemo(() => {
        const before = records.filter((r) => r.periodKey < periodKey);
        return before[before.length - 1];
    }, [records, periodKey]);
    const next = useMemo(
        () => records.find((r) => r.periodKey > periodKey),
        [records, periodKey]
    );

    const buildDrafts = useCallback(
        (record: CounterReadingRecord | undefined): DraftMap => {
            const map: DraftMap = {};
            sortedPrinters.forEach((p) => {
                const saved = valuesByPrinter(record, p.id, p.name);
                map[p.id] = saved
                    ? { ...saved, special: { ...(saved.special || {}) } }
                    : emptyValuesFromFields(getCounterFieldsForPrinter(p));
            });
            return map;
        },
        [sortedPrinters]
    );

    // Подставляем сохранённые значения периода (или пустые) при смене периода
    useEffect(() => {
        setDrafts(buildDrafts(current));
        setError('');
        setEditing(false);
    }, [current, buildDrafts]);

    /** Период уже внесён и мы его не правим — поля заблокированы */
    const locked = Boolean(current) && !editing;

    const startEditing = () => {
        setDrafts(buildDrafts(current));
        setError('');
        setEditing(true);
    };

    const cancelEditing = () => {
        setDrafts(buildDrafts(current));
        setError('');
        setEditing(false);
    };

    const updateField = (printerId: string, key: CounterFieldKey, raw: string) => {
        if (locked) return;
        const n = parseLifeExact(raw);
        setDrafts((prev) => ({
            ...prev,
            [printerId]: setFieldValue(prev[printerId] || { total: 0 }, key, n),
        }));
        setError('');
    };

    const handleSave = async () => {
        if (locked) {
            setError(
                'Показания за этот период уже внесены. Чтобы поправить их, нажмите «Изменить».'
            );
            return;
        }
        if (sortedPrinters.length === 0) {
            setError('Нет принтеров — добавьте их в администрировании');
            return;
        }

        const entries: CounterReadingPrinterEntry[] = [];
        for (const p of sortedPrinters) {
            const fields = getCounterFieldsForPrinter(p);
            const values = drafts[p.id] || emptyValuesFromFields(fields);
            const prevValues = valuesByPrinter(previous, p.id, p.name);
            const nextValues = valuesByPrinter(next, p.id, p.name);

            for (const f of fields) {
                const v = getFieldValue(values, f.key);
                if (!(v > 0)) {
                    setError(`Укажите «${f.label}» для «${p.name}»`);
                    return;
                }
                const prevV = getFieldValue(prevValues, f.key);
                if (prevV > 0 && v < prevV) {
                    setError(
                        `«${p.name}»: ${f.label} (${formatLifeWithCommas(v)}) меньше, чем в ${formatPeriodLabel(previous!.periodKey)} (${formatLifeWithCommas(prevV)})`
                    );
                    return;
                }
                const nextV = getFieldValue(nextValues, f.key);
                if (nextV > 0 && v > nextV) {
                    setError(
                        `«${p.name}»: ${f.label} (${formatLifeWithCommas(v)}) больше, чем в ${formatPeriodLabel(next!.periodKey)} (${formatLifeWithCommas(nextV)})`
                    );
                    return;
                }
            }

            entries.push({
                printerId: p.id,
                printerName: p.name,
                colorMode: p.colorMode === 'bw' ? 'bw' : 'color',
                values,
            });
        }

        const mode = current ? 'update' : 'create';
        try {
            await dispatch(
                completeCounterReading({ periodKey, mode, printers: entries })
            ).unwrap();
            // Сразу закрываем режим правки: пока грузится история,
            // поля не должны быть доступны для повторного ввода
            setEditing(false);
            setOkMessage(
                mode === 'update'
                    ? `Показания за ${formatPeriodLabel(periodKey)} обновлены.`
                    : `Счётчики за ${formatPeriodLabel(periodKey)} записаны. Повторный ввод за этот период закрыт — доступна только правка.`
            );
            await loadRecords();
            setOkOpen(true);
        } catch (err) {
            // Если период успели внести параллельно — подтянем запись, форма заблокируется
            await loadRecords();
            setError(
                err instanceof Error ? err.message : 'Не удалось сохранить'
            );
        }
    };

    const overdue =
        counterReadingDay && periodKey === activePeriod && !current
            ? getOverdueDays(counterReadingDay, periodKey)
            : 0;

    const history = useMemo(() => [...records].reverse(), [records]);
    // Поля показываем, как только есть принтеры; «Загрузка» — только пока их нет
    const printersPending = printersLoading && sortedPrinters.length === 0;
    const loading = printersPending || recordsLoading;

    return (
        <div className={cls.wrap}>
            <div className={cls.bar}>
                <label className={cls.periodField}>
                    <span>Период</span>
                    <input
                        type="month"
                        value={periodKey}
                        max={maxPeriod}
                        onChange={(e) =>
                            e.target.value && setPeriodKey(e.target.value)
                        }
                    />
                </label>

                <span
                    className={`${cls.status} ${
                        current
                            ? cls.statusDone
                            : overdue > 0
                              ? cls.statusOverdue
                              : cls.statusPending
                    }`}
                >
                    {current
                        ? `Снято ${formatDateTime(current.completedAt)}${
                              current.userName ? ` · ${current.userName}` : ''
                          }`
                        : overdue > 0
                          ? `Просрочено на ${overdue} дн.`
                          : 'Не снято'}
                </span>

                <div className={cls.actions}>
                    {locked ? (
                        <button
                            type="button"
                            className={cls.editBtn}
                            onClick={startEditing}
                            disabled={saving || loading}
                        >
                            Изменить
                        </button>
                    ) : (
                        <>
                            {editing && (
                                <button
                                    type="button"
                                    className={cls.cancelBtn}
                                    onClick={cancelEditing}
                                    disabled={saving}
                                >
                                    Отмена
                                </button>
                            )}
                            <button
                                type="button"
                                className={cls.saveBtn}
                                onClick={handleSave}
                                disabled={saving || loading}
                            >
                                {saving
                                    ? 'Сохранение…'
                                    : editing
                                      ? 'Сохранить изменения'
                                      : 'Сохранить показания'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <p className={cls.hint}>
                {locked ? (
                    <>
                        Показания за <b>{formatPeriodLabel(periodKey)}</b> уже
                        внесены
                        {current?.updatedAt
                            ? ` (изменены ${formatDateTime(current.updatedAt)}${
                                  current.updatedByName
                                      ? `, ${current.updatedByName}`
                                      : ''
                              })`
                            : ''}
                        . Повторный ввод закрыт — чтобы поправить, нажмите
                        «Изменить».
                    </>
                ) : (
                    <>
                        {editing ? 'Правка показаний за ' : 'Абсолютные показания с панели машины за '}
                        <b>{formatPeriodLabel(periodKey)}</b>.
                        {previous
                            ? ` Под полем — значение за ${formatPeriodLabel(previous.periodKey)}.`
                            : ''}
                    </>
                )}
            </p>

            {error && <p className={cls.error}>{error}</p>}

            {printersPending ? (
                <div className={cls.empty}>Загрузка…</div>
            ) : sortedPrinters.length === 0 ? (
                <div className={cls.empty}>Принтеры не найдены</div>
            ) : (
                <div className={cls.grid}>
                    {sortedPrinters.map((p) => {
                        const fields = getCounterFieldsForPrinter(p);
                        const values =
                            drafts[p.id] || emptyValuesFromFields(fields);
                        const prevValues = valuesByPrinter(
                            previous,
                            p.id,
                            p.name
                        );
                        return (
                            <div
                                key={p.id}
                                className={`${cls.card} ${locked ? cls.cardLocked : ''}`}
                            >
                                <div className={cls.cardHead}>
                                    <span className={cls.printerName}>
                                        {p.name}
                                    </span>
                                    <span className={cls.printerMeta}>
                                        {p.model}
                                        {p.colorMode === 'bw'
                                            ? ' · Ч/Б'
                                            : ' · цвет'}
                                    </span>
                                </div>
                                <div className={cls.fields}>
                                    {fields.map((f) => {
                                        const v = getFieldValue(values, f.key);
                                        const prevV = getFieldValue(
                                            prevValues,
                                            f.key
                                        );
                                        const delta =
                                            v > 0 && prevV > 0 && v >= prevV
                                                ? v - prevV
                                                : null;
                                        return (
                                            <label
                                                key={f.key}
                                                className={cls.field}
                                            >
                                                <span className={cls.fieldLabel}>
                                                    {f.label}
                                                </span>
                                                <input
                                                    className={cls.fieldInput}
                                                    inputMode="numeric"
                                                    disabled={locked}
                                                    readOnly={locked}
                                                    value={
                                                        v
                                                            ? formatLifeWithCommas(v)
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        updateField(
                                                            p.id,
                                                            f.key,
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="0"
                                                />
                                                <span className={cls.prev}>
                                                    {prevV > 0
                                                        ? `было ${formatLifeWithCommas(prevV)}`
                                                        : ' '}
                                                    {delta != null && (
                                                        <b>
                                                            {' '}
                                                            +{formatLifeWithCommas(delta)}
                                                        </b>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={cls.history}>
                <div className={cls.historyHead}>
                    <p className={cls.colPeriod}>Период</p>
                    <p className={cls.colMan}>Ответственный</p>
                    <p className={cls.colDate}>Дата ввода</p>
                </div>
                {recordsLoading ? (
                    <p className={cls.empty}>Загрузка истории…</p>
                ) : history.length === 0 ? (
                    <p className={cls.empty}>Показаний пока нет</p>
                ) : (
                    history.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            className={`${cls.historyRow} ${
                                r.periodKey === periodKey
                                    ? cls.historyRowActive
                                    : ''
                            }`}
                            onClick={() => setPeriodKey(r.periodKey)}
                            title="Открыть показания этого периода"
                        >
                            <span className={cls.colPeriod}>
                                {formatPeriodLabel(r.periodKey)}
                                {r.updatedAt ? (
                                    <span className={cls.editedMark}>
                                        изменено
                                    </span>
                                ) : null}
                            </span>
                            <span className={cls.colMan}>
                                {r.userName || '—'}
                            </span>
                            <span className={cls.colDate}>
                                {formatDateTime(r.completedAt)}
                            </span>
                        </button>
                    ))
                )}
            </div>

            <NotificationModal
                isOpen={okOpen}
                onClose={() => setOkOpen(false)}
                title="Показания сохранены"
                message={okMessage}
                type="success"
            />
        </div>
    );
};

export default CounterReadingForm;
