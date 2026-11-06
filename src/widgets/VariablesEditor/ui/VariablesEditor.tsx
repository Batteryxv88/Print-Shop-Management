import { useEffect, useState, FormEvent } from 'react';
import cls from './VariablesEditor.module.scss';
import { usePrinters } from '../../../app/providers/StoreProvider/Store/hooks';
import { useAppDispatch, useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import { loadAppSettings } from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';
import {
    loadLastCounterReading,
    saveCounterReadingDay,
} from '../../../app/providers/StoreProvider/Store/CounterReadingSlice';
import {
    addPrinter,
    updatePrinter,
    deletePrinter,
    createOptionId,
    Printer,
    PrinterInput,
    PrinterOption,
} from '../../../services/printers';
import { resolvePrinterColors } from '../../../shared/lib/printers/tonerColors';
import ExcelPartsUpload from './ExcelPartsUpload';
import ColorConfigFields from './ColorConfigFields';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';
import { seedTestCounterReadings } from '../../../services/seedTestCounterReadings';

type Section = 'printers' | 'schedule';

const emptyForm: PrinterInput = {
    name: '',
    model: '',
    ip: '',
    serialNumber: '',
    options: [],
    colorMode: 'color',
    colors: ['C', 'M', 'Y', 'K'],
};

const VariablesEditor = () => {
    const dispatch = useAppDispatch();
    const { printers, isLoading } = usePrinters();
    const {
        counterReadingDay,
        settingsLoaded,
        saving: scheduleSaving,
        error: scheduleError,
    } = useAppSelector((state) => state.counterReading);

    const [section, setSection] = useState<Section>('printers');
    const [form, setForm] = useState<PrinterInput>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [dayDraft, setDayDraft] = useState('');
    const [daySavedFlash, setDaySavedFlash] = useState(false);
    const [seedStatus, setSeedStatus] = useState('');
    const [seedBusy, setSeedBusy] = useState(false);

    const [optionDraft, setOptionDraft] = useState({ model: '', serialNumber: '' });
    const [editSnapshot, setEditSnapshot] = useState<{
        name: string;
        ip: string;
        serialNumber: string;
    } | null>(null);
    const [identityPrompt, setIdentityPrompt] = useState<{
        payload: PrinterInput;
    } | null>(null);

    const identityFieldsChanged = (
        payload: PrinterInput,
        snap: { name: string; ip: string; serialNumber: string }
    ) =>
        payload.name.trim() !== snap.name.trim() ||
        (payload.ip || '').trim() !== snap.ip.trim() ||
        (payload.serialNumber || '').trim() !== snap.serialNumber.trim();

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    useEffect(() => {
        if (!settingsLoaded) return;
        setDayDraft(
            counterReadingDay != null ? String(counterReadingDay) : ''
        );
    }, [settingsLoaded, counterReadingDay]);

    const handleSaveCounterDay = async (e: FormEvent) => {
        e.preventDefault();
        setDaySavedFlash(false);
        const trimmed = dayDraft.trim();
        if (!trimmed) {
            await dispatch(saveCounterReadingDay(null));
            setDaySavedFlash(true);
            return;
        }
        const day = Number(trimmed);
        if (!Number.isFinite(day) || day < 1 || day > 31) {
            return;
        }
        const result = await dispatch(saveCounterReadingDay(Math.round(day)));
        if (saveCounterReadingDay.fulfilled.match(result)) {
            setDaySavedFlash(true);
        }
    };

    const validate = (data: PrinterInput): string | null => {
        const name = data.name.trim();
        const model = data.model.trim();

        if (name.length < 3) {
            return 'Имя принтера обязательно и должно быть не меньше 3 символов';
        }
        if (!model) {
            return 'Модель принтера обязательна';
        }

        const duplicate = printers.find(
            (p) =>
                p.name.toLowerCase() === name.toLowerCase() &&
                p.id !== editingId
        );
        if (duplicate) {
            return 'Принтер с таким именем уже существует';
        }

        return null;
    };

    const finishPrinterForm = () => {
        setForm(emptyForm);
        setEditingId(null);
        setEditSnapshot(null);
        setIdentityPrompt(null);
    };

    const savePrinterWithIdentity = async (
        payload: PrinterInput,
        sameMachine: boolean
    ) => {
        if (!editingId) {
            await addPrinter(payload);
            return;
        }
        if (sameMachine) {
            await updatePrinter(editingId, payload);
            return;
        }
        await addPrinter(payload);
        await deletePrinter(editingId);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        const validationError = validate(form);
        if (validationError) {
            setError(validationError);
            return;
        }

        const payload: PrinterInput = {
            name: form.name.trim(),
            model: form.model.trim(),
            ip: form.ip?.trim() || '',
            serialNumber: form.serialNumber?.trim() || '',
            options: form.options || [],
            colorMode: form.colorMode || 'color',
            colors: resolvePrinterColors(form),
        };

        if (
            editingId &&
            editSnapshot &&
            identityFieldsChanged(payload, editSnapshot)
        ) {
            setIdentityPrompt({ payload });
            return;
        }

        setSaving(true);
        try {
            await savePrinterWithIdentity(payload, true);
            finishPrinterForm();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить принтер'
            );
        } finally {
            setSaving(false);
        }
    };

    const confirmIdentity = async (sameMachine: boolean) => {
        if (!identityPrompt) return;
        setSaving(true);
        setError('');
        try {
            await savePrinterWithIdentity(identityPrompt.payload, sameMachine);
            finishPrinterForm();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить принтер'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (printer: Printer) => {
        setEditingId(printer.id);
        setExpandedId(printer.id);
        setForm({
            name: printer.name,
            model: printer.model,
            ip: printer.ip || '',
            serialNumber: printer.serialNumber || '',
            options: printer.options ? [...printer.options] : [],
            colorMode: printer.colorMode || 'color',
            colors: resolvePrinterColors(printer),
        });
        setOptionDraft({ model: '', serialNumber: '' });
        setEditSnapshot({
            name: printer.name,
            ip: printer.ip || '',
            serialNumber: printer.serialNumber || '',
        });
        setError('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(emptyForm);
        setOptionDraft({ model: '', serialNumber: '' });
        setEditSnapshot(null);
        setIdentityPrompt(null);
        setError('');
    };

    const handleDelete = async (printer: Printer) => {
        const confirmed = window.confirm(
            `Удалить принтер «${printer.name}»? История операций останется в базе по id аппарата, но в программе он больше не будет отображаться.`
        );
        if (!confirmed) return;

        try {
            await deletePrinter(printer.id);
            if (editingId === printer.id) {
                handleCancelEdit();
            }
            if (expandedId === printer.id) {
                setExpandedId(null);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось удалить принтер'
            );
        }
    };

    const persistPrinter = async (
        printer: Printer,
        patch: Partial<PrinterInput>
    ) => {
        await updatePrinter(printer.id, {
            name: printer.name,
            model: printer.model,
            ip: printer.ip || '',
            serialNumber: printer.serialNumber || '',
            options: printer.options || [],
            colorMode: printer.colorMode || 'color',
            colors: resolvePrinterColors(printer),
            ...patch,
        });
    };

    const handleSaveSerial = async (printer: Printer, serialNumber: string) => {
        try {
            await persistPrinter(printer, { serialNumber: serialNumber.trim() });
            if (editingId === printer.id) {
                setForm((prev) => ({ ...prev, serialNumber: serialNumber.trim() }));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить серийный номер'
            );
        }
    };

    const handleAddOption = async (printer: Printer) => {
        const model = optionDraft.model.trim();
        if (model.length < 2) {
            setError('Модель опции обязательна (минимум 2 символа)');
            return;
        }

        const newOption: PrinterOption = {
            id: createOptionId(),
            model,
            serialNumber: optionDraft.serialNumber.trim(),
        };

        const options = [...(printer.options || []), newOption];
        try {
            await persistPrinter(printer, { options });
            setOptionDraft({ model: '', serialNumber: '' });
            setError('');
            if (editingId === printer.id) {
                setForm((prev) => ({ ...prev, options }));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось добавить опцию'
            );
        }
    };

    const handleUpdateOption = async (
        printer: Printer,
        optionId: string,
        patch: Partial<PrinterOption>
    ) => {
        const options = (printer.options || []).map((opt) =>
            opt.id === optionId ? { ...opt, ...patch } : opt
        );
        try {
            await persistPrinter(printer, { options });
            if (editingId === printer.id) {
                setForm((prev) => ({ ...prev, options }));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось обновить опцию'
            );
        }
    };

    const handleDeleteOption = async (printer: Printer, optionId: string) => {
        const option = (printer.options || []).find((o) => o.id === optionId);
        const confirmed = window.confirm(
            `Удалить опцию «${option?.model || ''}» у принтера «${printer.name}»? Каталог деталей опции на складе останется.`
        );
        if (!confirmed) return;

        const options = (printer.options || []).filter((o) => o.id !== optionId);
        try {
            await persistPrinter(printer, { options });
            if (editingId === printer.id) {
                setForm((prev) => ({ ...prev, options }));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось удалить опцию'
            );
        }
    };

    return (
        <div className={cls.editor}>
            <h2 className={cls.h2}>Редактор переменных</h2>

            <div className={cls.sections}>
                <button
                    type="button"
                    className={
                        section === 'printers'
                            ? cls.sectionActive
                            : cls.sectionButton
                    }
                    onClick={() => setSection('printers')}
                >
                    Принтеры
                </button>
                <button
                    type="button"
                    className={
                        section === 'schedule'
                            ? cls.sectionActive
                            : cls.sectionButton
                    }
                    onClick={() => setSection('schedule')}
                >
                    Расписание
                </button>
            </div>

            {section === 'schedule' && (
                <div className={cls.content}>
                    <p className={cls.hint}>
                        Дата снятия счётчиков — число месяца, в которое нужно
                        снимать показания. В этот день программа напомнит; если
                        не отметить снятие, напоминание останется до выполнения.
                    </p>

                    <form
                        className={`${cls.form} ${cls.scheduleForm}`}
                        onSubmit={handleSaveCounterDay}
                    >
                        <div className={cls.scheduleRow}>
                            <label className={cls.scheduleLabel} htmlFor="counterReadingDay">
                                Дата снятия счетчиков
                            </label>
                            <input
                                id="counterReadingDay"
                                className={`${cls.input} ${cls.dayInput}`}
                                type="number"
                                min={1}
                                max={31}
                                value={dayDraft}
                                onChange={(e) => {
                                    setDayDraft(e.target.value);
                                    setDaySavedFlash(false);
                                }}
                                placeholder="15"
                            />
                            <button
                                type="submit"
                                className={cls.submit}
                                disabled={scheduleSaving}
                            >
                                {scheduleSaving ? '...' : 'Сохранить'}
                            </button>
                            {daySavedFlash && !scheduleError && (
                                <span className={cls.success}>Сохранено</span>
                            )}
                        </div>
                        <p className={cls.fieldHint}>
                            День месяца (1–31). В короткие месяцы — последний день.
                            Пусто = напоминания выкл.
                        </p>
                        {scheduleError && (
                            <p className={cls.error}>{scheduleError}</p>
                        )}
                    </form>

                    <div className={cls.seedBox}>
                        <button
                            type="button"
                            className={cls.cancel}
                            disabled={seedBusy}
                            onClick={async () => {
                                setSeedBusy(true);
                                setSeedStatus('');
                                try {
                                    const r = await seedTestCounterReadings();
                                    await dispatch(loadLastCounterReading());
                                    setSeedStatus(
                                        `Ок: ${r.dateKeys.join(', ')}. ` +
                                            `Найдено: ${r.matched.join('; ') || '—'}` +
                                            (r.missing.length
                                                ? `. Не найдены: ${r.missing.join(', ')}. В базе: ${r.printersInDb.join(', ')}`
                                                : '')
                                    );
                                } catch (err) {
                                    setSeedStatus(
                                        err instanceof Error
                                            ? err.message
                                            : 'Ошибка заливки'
                                    );
                                } finally {
                                    setSeedBusy(false);
                                }
                            }}
                        >
                            {seedBusy
                                ? 'Заливка…'
                                : 'Залить тест счётчиков (окт → янв)'}
                        </button>
                        {seedStatus && (
                            <p className={cls.fieldHint}>{seedStatus}</p>
                        )}
                    </div>
                </div>
            )}

            {section === 'printers' && (
                <div className={cls.content}>
                    <p className={cls.hint}>
                        Имя — в отчётах и заменах. Модель группирует склады.
                        Тип печати задаёт тонеры: Ч/Б = K, цветной = CMYK, можно
                        добавить цвета (например W для Label 400). Склад тонеров
                        создаётся автоматически.
                    </p>

                    <form className={cls.form} onSubmit={handleSubmit}>
                        <div className={cls.formRow}>
                            <label className={cls.label}>
                                Имя *
                                <input
                                    className={cls.input}
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder="например C71cf"
                                    minLength={3}
                                    required
                                />
                            </label>
                            <label className={cls.label}>
                                Модель *
                                <input
                                    className={cls.input}
                                    value={form.model}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            model: e.target.value,
                                        }))
                                    }
                                    placeholder="например AccurioPress C3070"
                                    required
                                />
                            </label>
                            <label className={cls.label}>
                                Серийный номер
                                <input
                                    className={cls.input}
                                    value={form.serialNumber || ''}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            serialNumber: e.target.value,
                                        }))
                                    }
                                    placeholder="S/N тушки"
                                />
                            </label>
                            <label className={cls.label}>
                                IP
                                <input
                                    className={cls.input}
                                    value={form.ip}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            ip: e.target.value,
                                        }))
                                    }
                                    placeholder="192.168.0.10"
                                />
                            </label>
                        </div>

                        <ColorConfigFields
                            colorMode={form.colorMode || 'color'}
                            colors={form.colors || ['C', 'M', 'Y', 'K']}
                            onChange={({ colorMode, colors }) =>
                                setForm((prev) => ({
                                    ...prev,
                                    colorMode,
                                    colors,
                                }))
                            }
                        />

                        {error && <p className={cls.error}>{error}</p>}

                        <div className={cls.formActions}>
                            <button
                                type="submit"
                                className={cls.submit}
                                disabled={saving}
                            >
                                {editingId
                                    ? saving
                                        ? 'Сохранение...'
                                        : 'Сохранить'
                                    : saving
                                      ? 'Добавление...'
                                      : 'Добавить принтер'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    className={cls.cancel}
                                    onClick={handleCancelEdit}
                                >
                                    Отмена
                                </button>
                            )}
                        </div>
                    </form>

                    <div className={cls.tableWrapper}>
                        {isLoading && printers.length === 0 ? (
                            <p className={cls.empty}>Загрузка...</p>
                        ) : printers.length === 0 ? (
                            <p className={cls.empty}>Принтеры не найдены</p>
                        ) : (
                            <div className={cls.printerList}>
                                {printers.map((printer) => {
                                    const expanded = expandedId === printer.id;
                                    return (
                                        <div
                                            key={printer.id}
                                            className={cls.printerCard}
                                        >
                                            <div className={cls.printerHeader}>
                                                <div className={cls.printerInfo}>
                                                    <strong>{printer.name}</strong>
                                                    <span>{printer.model}</span>
                                                    <span>
                                                        S/N:{' '}
                                                        {printer.serialNumber || '—'}
                                                    </span>
                                                    <span>
                                                        IP: {printer.ip || '—'}
                                                    </span>
                                                    <span>
                                                        Опций:{' '}
                                                        {(printer.options || []).length}
                                                    </span>
                                                    <span>
                                                        Тонеры:{' '}
                                                        {resolvePrinterColors(printer).join(
                                                            ', '
                                                        )}
                                                    </span>
                                                </div>
                                                <div className={cls.actions}>
                                                    <button
                                                        type="button"
                                                        className={cls.editBtn}
                                                        onClick={() =>
                                                            setExpandedId(
                                                                expanded
                                                                    ? null
                                                                    : printer.id
                                                            )
                                                        }
                                                    >
                                                        {expanded
                                                            ? 'Свернуть'
                                                            : 'Опции и Excel'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cls.editBtn}
                                                        onClick={() =>
                                                            handleEdit(printer)
                                                        }
                                                    >
                                                        Изменить
                                                    </button>
                                                    <DeleteButton
                                                        label={`Удалить принтер «${printer.name}»`}
                                                        onClick={() =>
                                                            handleDelete(printer)
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            {expanded && (
                                                <div className={cls.printerBody}>
                                                    <div className={cls.subBlock}>
                                                        <h4 className={cls.subTitle}>
                                                            Тушка · {printer.model}
                                                        </h4>
                                                        <label className={cls.label}>
                                                            Серийный номер тушки
                                                            <input
                                                                className={cls.input}
                                                                defaultValue={
                                                                    printer.serialNumber ||
                                                                    ''
                                                                }
                                                                key={`sn-${printer.id}-${printer.serialNumber}`}
                                                                onBlur={(e) =>
                                                                    handleSaveSerial(
                                                                        printer,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="S/N"
                                                            />
                                                        </label>
                                                        <ColorConfigFields
                                                            colorMode={
                                                                printer.colorMode || 'color'
                                                            }
                                                            colors={resolvePrinterColors(
                                                                printer
                                                            )}
                                                            onChange={({
                                                                colorMode,
                                                                colors,
                                                            }) =>
                                                                persistPrinter(printer, {
                                                                    colorMode,
                                                                    colors,
                                                                })
                                                            }
                                                        />
                                                        <ExcelPartsUpload
                                                            printerModel={printer.model}
                                                            source="body"
                                                            label="Excel ресурсных деталей тушки"
                                                        />
                                                    </div>

                                                    <div className={cls.subBlock}>
                                                        <h4 className={cls.subTitle}>
                                                            Опции
                                                        </h4>
                                                        <div className={cls.optionForm}>
                                                            <input
                                                                className={cls.input}
                                                                value={optionDraft.model}
                                                                onChange={(e) =>
                                                                    setOptionDraft(
                                                                        (prev) => ({
                                                                            ...prev,
                                                                            model: e.target
                                                                                .value,
                                                                        })
                                                                    )
                                                                }
                                                                placeholder="Модель опции (LU-202, FS-532…)"
                                                            />
                                                            <input
                                                                className={cls.input}
                                                                value={
                                                                    optionDraft.serialNumber
                                                                }
                                                                onChange={(e) =>
                                                                    setOptionDraft(
                                                                        (prev) => ({
                                                                            ...prev,
                                                                            serialNumber:
                                                                                e.target
                                                                                    .value,
                                                                        })
                                                                    )
                                                                }
                                                                placeholder="S/N опции"
                                                            />
                                                            <button
                                                                type="button"
                                                                className={cls.submit}
                                                                onClick={() =>
                                                                    handleAddOption(
                                                                        printer
                                                                    )
                                                                }
                                                            >
                                                                Добавить опцию
                                                            </button>
                                                        </div>

                                                        {(printer.options || [])
                                                            .length === 0 ? (
                                                            <p className={cls.empty}>
                                                                Опций пока нет
                                                            </p>
                                                        ) : (
                                                            (printer.options || []).map(
                                                                (opt) => (
                                                                    <div
                                                                        key={opt.id}
                                                                        className={
                                                                            cls.optionCard
                                                                        }
                                                                    >
                                                                        <div
                                                                            className={
                                                                                cls.optionRow
                                                                            }
                                                                        >
                                                                            <label
                                                                                className={
                                                                                    cls.label
                                                                                }
                                                                            >
                                                                                Модель
                                                                                <input
                                                                                    className={
                                                                                        cls.input
                                                                                    }
                                                                                    defaultValue={
                                                                                        opt.model
                                                                                    }
                                                                                    key={`m-${opt.id}-${opt.model}`}
                                                                                    onBlur={(
                                                                                        e
                                                                                    ) =>
                                                                                        handleUpdateOption(
                                                                                            printer,
                                                                                            opt.id,
                                                                                            {
                                                                                                model: e
                                                                                                    .target
                                                                                                    .value.trim(),
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </label>
                                                                            <label
                                                                                className={
                                                                                    cls.label
                                                                                }
                                                                            >
                                                                                Серийный номер
                                                                                <input
                                                                                    className={
                                                                                        cls.input
                                                                                    }
                                                                                    defaultValue={
                                                                                        opt.serialNumber ||
                                                                                        ''
                                                                                    }
                                                                                    key={`s-${opt.id}-${opt.serialNumber}`}
                                                                                    onBlur={(
                                                                                        e
                                                                                    ) =>
                                                                                        handleUpdateOption(
                                                                                            printer,
                                                                                            opt.id,
                                                                                            {
                                                                                                serialNumber:
                                                                                                    e.target.value.trim(),
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </label>
                                                                            <DeleteButton
                                                                                label={`Удалить опцию «${opt.model || ''}»`}
                                                                                onClick={() =>
                                                                                    handleDeleteOption(
                                                                                        printer,
                                                                                        opt.id
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <ExcelPartsUpload
                                                                            printerModel={
                                                                                printer.model
                                                                            }
                                                                            source="option"
                                                                            optionModel={
                                                                                opt.model
                                                                            }
                                                                            label={`Excel деталей опции ${opt.model}`}
                                                                        />
                                                                    </div>
                                                                )
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {identityPrompt ? (
                <div className={cls.modalOverlay} role="dialog" aria-modal>
                    <div className={cls.modalCard}>
                        <h3 className={cls.modalTitle}>
                            Изменились данные аппарата
                        </h3>
                        <p className={cls.modalText}>
                            Это та же физическая машина (сохранить учёт по id)
                            или другая (новый учёт, старая история останется в
                            базе, но скрыта)?
                        </p>
                        <p className={cls.modalHint}>
                            Если меняли только IP или серийник без смены имени
                            и нужен новый учёт — добавьте новый принтер и
                            удалите старый.
                        </p>
                        <div className={cls.modalActions}>
                            <button
                                type="button"
                                className={cls.modalPrimary}
                                disabled={saving}
                                onClick={() => void confirmIdentity(true)}
                            >
                                Та же машина
                            </button>
                            <button
                                type="button"
                                className={cls.modalSecondary}
                                disabled={saving}
                                onClick={() => void confirmIdentity(false)}
                            >
                                Другая машина
                            </button>
                            <button
                                type="button"
                                className={cls.modalGhost}
                                disabled={saving}
                                onClick={() => setIdentityPrompt(null)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default VariablesEditor;
