import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import cls from './MaintenanceForm.module.scss';
import type { PartPickerOption } from '../PurchaseStock/PartPicker';
import { useAuth } from '../../../contexts/AuthContext';
import { usePrinters } from '../../../app/providers/StoreProvider/Store/hooks';
import { db } from '../../../services/firebase';
import { writeOffFifo } from '../../../services/stockAccounting';
import type { Part } from '../../../services/parts';
import {
    addLinkedUsedPart,
    appendMaintenanceEntry,
    createMaintenanceTicket,
    type NeededPartLine,
    type ReplacedPartLine,
} from '../../../services/maintenance';
import {
    emptyValuesFromFields,
    getCounterFieldsForPrinter,
    getFieldValue,
    setFieldValue,
    type PrinterCounterValues,
} from '../../../shared/lib/counterReading/fields';
import {
    formatLifeWithCommas,
    parseLifeExact,
} from '../../../shared/lib/formatLifeInput';
import { lifePercent } from '../../../shared/lib/calculatePercentOfLife';
import { askMaintenanceLeave } from '../../../shared/lib/maintenance/leave';
import { parsePartLife } from '../../../shared/lib/printers/parsePartLife';
import { inferPartCostCategory } from '../../../shared/lib/stock/costCategory';
import {
    getModelByPrinterId,
    getPrinterById,
    getPrinterNameById,
} from '../../../shared/lib/printers/printerIdentity';
import {
    sortSections,
} from '../../../shared/lib/printers/sectionOrder';
import {
    MAINTENANCE_STATUSES,
    MAINTENANCE_TYPES,
    maintenanceDraftError,
    maintenanceStatusLabel,
    maintenanceTypeLabel,
    type MaintenanceStatus,
    type MaintenanceType,
} from '../../../shared/lib/maintenance/draft';

type StockRow = { id: string; part: Part };

type LineDraft = {
    key: string;
    query: string;
    stockId: string | null;
    name: string;
    quantity: string;
    life: string;
    noLife: boolean;
};

type ShelfRow = {
    key: string;
    id: string;
    partN: string;
    partName: string;
    section: string;
    qty: number;
};

type Props = {
    mode: 'create' | 'append';
    printerId: string;
    ticketId?: string;
    ticketType?: MaintenanceType;
    ticketStatus?: MaintenanceStatus;
    onClose: () => void;
};

const newLine = (): LineDraft => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    query: '',
    stockId: null,
    name: '',
    quantity: '1',
    life: '',
    noLife: false,
});

const installRows = (item: StockRow): ShelfRow[] => {
    const part = item.part;
    const cardSection = String(part.section || '');
    const partN = String(part.partN || '');
    const qty = Number(part.quantity) || 0;
    const stored = Array.isArray(part.names)
        ? part.names.map((name) => String(name).trim()).filter(Boolean)
        : [];
    const fallback = String(part.partName || '').trim();
    const names = stored.length > 0 ? stored : fallback ? [fallback] : [];
    const seen = new Set(names.map((name) => name.toLowerCase()));
    const rows: ShelfRow[] = names.map((name) => ({
        key: `${item.id}:${name.toLowerCase()}`,
        id: item.id,
        partN,
        partName: name,
        section: cardSection,
        qty,
    }));
    (part.assemblyLines || []).forEach((line) => {
        const name = String(line.partName || '').trim();
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        rows.push({
            key: `${item.id}:${name.toLowerCase()}`,
            id: item.id,
            partN,
            partName: name,
            section: String(line.section || cardSection),
            qty,
        });
    });
    return rows;
};

const chosenLabel = (card: StockRow, line: LineDraft) => {
    const partName =
        line.name.trim() || String(card.part.partName || '');
    const assembly = (card.part.assemblyLines || []).find(
        (item) =>
            String(item.partName || '').trim().toLowerCase() ===
            partName.toLowerCase()
    );
    return {
        partName,
        section: String(assembly?.section || card.part.section || ''),
        factoryLife: parsePartLife(assembly?.partLife || card.part.partLife),
    };
};

const MaintenanceForm = ({
    mode,
    printerId,
    ticketId,
    ticketType,
    ticketStatus,
    onClose,
}: Props) => {
    const { userData } = useAuth();
    const { printers } = usePrinters();
    const printer = getPrinterById(printers, printerId);
    const printerModel = getModelByPrinterId(printers, printerId);
    const machineName = getPrinterNameById(printers, printerId);

    const [type, setType] = useState<MaintenanceType>('incident');
    const [status] = useState<MaintenanceStatus>(ticketStatus ?? 'new');
    const [problem, setProblem] = useState('');
    const [workDone, setWorkDone] = useState('');
    const [notes, setNotes] = useState('');
    const [counters, setCounters] = useState<PrinterCounterValues>({ total: 0 });
    const [replaced, setReplaced] = useState<LineDraft[]>([]);
    const [needed, setNeeded] = useState<LineDraft[]>([]);
    const [stock, setStock] = useState<StockRow[]>([]);
    const [partsLoading, setPartsLoading] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [statusPick, setStatusPick] = useState<MaintenanceStatus>(
        ticketStatus ?? 'new'
    );
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [toast, setToast] = useState<{
        id: number;
        text: string;
        left: number;
        top: number;
        note: boolean;
    } | null>(null);
    const [section, setSection] = useState('');
    const [partQuery, setPartQuery] = useState('');
    const [basket, setBasket] = useState<'replaced' | 'needed'>('replaced');
    const [addingCard, setAddingCard] = useState(false);
    const [newCard, setNewCard] = useState({
        partN: '',
        partName: '',
        section: '',
    });

    const writtenRef = useRef<
        { key: string; line: ReplacedPartLine; linked: boolean }[]
    >([]);
    const savedRef = useRef<{ ticketId: string; entryId: string } | null>(null);
    const toastTimer = useRef<number | null>(null);

    const fieldSignature = printer
        ? `${printer.colorMode}|${(printer.colors || []).join(',')}`
        : 'total';
    const fields = useMemo(
        () =>
            printer
                ? getCounterFieldsForPrinter(printer)
                : [{ key: 'total' as const, label: 'Общий' }],
        // Поля зависят от режима цвета, не от каждой копии объекта принтера.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [fieldSignature]
    );

    useEffect(() => {
        setCounters(emptyValuesFromFields(fields));
    }, [fields]);

    useEffect(() => {
        return () => {
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!printerModel) return;
        let cancelled = false;
        setPartsLoading(true);
        getDocs(query(collection(db, 'Parts'), where('model', '==', printerModel)))
            .then((snap) => {
                if (cancelled) return;
                setStock(
                    snap.docs.map((item) => ({
                        id: item.id,
                        part: item.data() as Part,
                    }))
                );
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                setSubmitError(message || 'Не удалось прочитать склад');
            })
            .finally(() => {
                if (!cancelled) setPartsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [printerModel]);

    const options = useMemo<PartPickerOption[]>(
        () =>
            stock
                .map((item) => ({
                    id: item.id,
                    partN: String(item.part.partN || ''),
                    partName: String(item.part.partName || ''),
                    section: String(item.part.section || ''),
                    qty: Number(item.part.quantity) || 0,
                }))
                .sort((a, b) => a.partN.localeCompare(b.partN, 'ru')),
        [stock]
    );

    const sections = useMemo(() => {
        const fromStock = stock.map((item) => String(item.part.section || '').trim());
        (stock).forEach((item) => {
            (item.part.assemblyLines || []).forEach((line) => {
                const section = String(line.section || '').trim();
                if (section) fromStock.push(section);
            });
        });
        return sortSections(fromStock);
    }, [stock]);

    const shelfRows = useMemo(
        () =>
            stock
                .flatMap(installRows)
                .sort((a, b) => a.partN.localeCompare(b.partN, 'ru')),
        [stock]
    );

    const patchLine = (
        kind: 'replaced' | 'needed',
        key: string,
        patch: Partial<LineDraft>
    ) => {
        const setter = kind === 'replaced' ? setReplaced : setNeeded;
        setter((rows) =>
            rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
        );
    };

    const showToast = (text: string, anchor?: HTMLElement, note = false) => {
        const width = 280;
        const rect = anchor?.getBoundingClientRect();
        let left = 16;
        let top = 72;
        if (rect) {
            const gap = 8;
            const fitsRight = rect.right + gap + width <= window.innerWidth - 8;
            left = fitsRight
                ? rect.right + gap
                : Math.max(8, rect.left - gap - width);
            top = Math.min(Math.max(8, rect.top), window.innerHeight - 48);
        }
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        setToast({ id: Date.now(), text, left, top, note });
        toastTimer.current = window.setTimeout(() => setToast(null), 2000);
    };

    const takePart = (
        kind: 'replaced' | 'needed',
        option: {
            id: string;
            partN: string;
            partName: string;
            section?: string;
            qty?: number;
        },
        anchor?: HTMLElement
    ): boolean => {
        const name = option.partName.trim();
        const qty = Number(option.qty) || 0;
        if (kind === 'replaced' && qty < 1) {
            showToast(
                'Невозможно списать позицию, остаток на складе 0',
                anchor
            );
            return false;
        }
        if (kind === 'needed' && qty >= 1) {
            showToast('На складе есть эта позиция', anchor, true);
        }
        setSubmitError('');
        const setter = kind === 'replaced' ? setReplaced : setNeeded;
        setter((list) => {
            if (
                list.some(
                    (line) =>
                        line.stockId === option.id &&
                        line.name.toLowerCase() === name.toLowerCase()
                )
            ) {
                return list;
            }
            return [
                ...list,
                {
                    ...newLine(),
                    query: option.partN,
                    stockId: option.id,
                    name,
                },
            ];
        });
        return true;
    };

    useEffect(() => {
        if (sections.length === 0) {
            if (section) setSection('');
            return;
        }
        if (section && sections.includes(section)) return;
        setSection(sections[0]);
    }, [sections, section]);

    const createCard = async () => {
        if (!addingCard) return;
        const partN = newCard.partN.trim().toUpperCase();
        const partName = newCard.partName.trim();
        const section = newCard.section.trim();
        if (partN.length < 3) {
            setSubmitError('Артикул — минимум 3 символа');
            return;
        }
        if (partName.length < 2) {
            setSubmitError('Укажите наименование детали');
            return;
        }
        if (!section) {
            setSubmitError('Выберите секцию');
            return;
        }
        const existing = stock.find(
            (item) => String(item.part.partN || '').toUpperCase() === partN
        );
        if (existing) {
            const added = takePart(basket, {
                id: existing.id,
                partN,
                partName: String(existing.part.partName || partName),
                section: String(existing.part.section || section),
                qty: Number(existing.part.quantity) || 0,
            });
            setAddingCard(false);
            if (added) {
                setSubmitError('Такая карточка уже есть на складе, она выбрана');
            }
            return;
        }
        setSubmitting(true);
        setSubmitError('');
        try {
            const ref = await addDoc(collection(db, 'Parts'), {
                partN,
                partName,
                quantity: 0,
                partLife: '',
                section,
                installedQty: 0,
                source: 'manual',
                ...(printerModel ? { model: printerModel } : {}),
            });
            const created: StockRow = {
                id: ref.id,
                part: {
                    partN,
                    partName,
                    quantity: 0,
                    partLife: '',
                    section,
                    model: printerModel,
                    source: 'manual',
                },
            };
            setStock((rows) => [...rows, created]);
            takePart(basket, {
                id: ref.id,
                partN,
                partName,
                section,
                qty: 0,
            });
            setAddingCard(false);
            setNewCard({ partN: '', partName: '', section: '' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setSubmitError(message || 'Не удалось добавить карточку');
        } finally {
            setSubmitting(false);
        }
    };

    const filled = (rows: LineDraft[]) =>
        rows.filter((row) => row.stockId || row.query.trim());

    const save = async (nextStatus: MaintenanceStatus) => {
        setStatusOpen(false);
        setSubmitError('');
        const neededFilled = filled(needed);
        const textError = maintenanceDraftError({
            problem,
            workDone,
            notes,
            status: nextStatus,
            neededCount:
                nextStatus === 'waiting_parts'
                    ? neededFilled.filter((row) => row.stockId).length
                    : 0,
        });
        if (textError) {
            setSubmitError(textError);
            return;
        }

        const replacedFilled = filled(replaced);
        for (const line of replacedFilled) {
            if (writtenRef.current.some((item) => item.key === line.key)) continue;
            if (!line.stockId) {
                setSubmitError('Выберите заменяемую деталь из списка склада');
                return;
            }
            if (!(Number(line.quantity) >= 1)) {
                setSubmitError('Количество замены — минимум 1');
                return;
            }
            if (!line.noLife && !(parseLifeExact(line.life) > 0)) {
                setSubmitError('Укажите пройденный ресурс заменённой детали');
                return;
            }
        }
        if (neededFilled.length > 0 && nextStatus !== 'waiting_parts') {
            setSubmitError(
                'Заказ записывается только со статусом «Ожидает детали»'
            );
            return;
        }
        if (mode === 'append' && !ticketId) {
            setSubmitError('Не выбрана заявка');
            return;
        }
        if (nextStatus === 'waiting_parts') {
            for (const line of neededFilled) {
                if (!line.stockId) {
                    setSubmitError('Выберите нужную деталь из списка склада');
                    return;
                }
                if (!(Number(line.quantity) >= 1)) {
                    setSubmitError('Количество нужной детали — минимум 1');
                    return;
                }
            }
        }

        const demand = new Map<string, number>();
        replacedFilled.forEach((line) => {
            if (!line.stockId) return;
            if (writtenRef.current.some((item) => item.key === line.key)) return;
            demand.set(
                line.stockId,
                (demand.get(line.stockId) || 0) + Number(line.quantity)
            );
        });
        for (const [id, qty] of Array.from(demand.entries())) {
            const card = stock.find((item) => item.id === id);
            const have = Number(card?.part.quantity) || 0;
            if (!card || have < qty) {
                setSubmitError(
                    `На складе не хватает ${card?.part.partN || 'детали'}: есть ${have}, нужно ${qty}. Карточку с нулевым остатком можно указать как нужную.`
                );
                return;
            }
        }

        setSubmitting(true);
        const date = new Date().toISOString();
        const man = userData?.displayName || '';
        const running = new Map<string, number>();
        let parkFailed = false;
        let parked = false;

        try {
            for (const line of replacedFilled) {
                if (writtenRef.current.some((item) => item.key === line.key)) {
                    continue;
                }
                const card = stock.find((item) => item.id === line.stockId);
                if (!card) throw new Error('Деталь исчезла из списка склада');
                const qty = Number(line.quantity);
                const have = running.has(card.id)
                    ? running.get(card.id)!
                    : Number(card.part.quantity) || 0;
                const actualLife = line.noLife ? 0 : parseLifeExact(line.life);
                const label = chosenLabel(card, line);
                const factoryLife = label.factoryLife;
                const writeOff = await writeOffFifo({
                    type: 'part',
                    stockId: card.id,
                    partN: String(card.part.partN || ''),
                    partName: label.partName,
                    model: card.part.model || printerModel || '',
                    costCategory: inferPartCostCategory(card.part),
                    qty,
                    date,
                    machine: machineName,
                    printerId,
                    man,
                    currentStockQty: have,
                    factoryLife,
                    actualLife,
                });
                running.set(card.id, have - qty);
                setStock((rows) =>
                    rows.map((item) =>
                        item.id === card.id
                            ? {
                                  ...item,
                                  part: {
                                      ...item.part,
                                      quantity: have - qty,
                                  },
                              }
                            : item
                    )
                );
                writtenRef.current.push({
                    key: line.key,
                    linked: false,
                    line: {
                        stockId: card.id,
                        partN: String(card.part.partN || ''),
                        partName: label.partName,
                        section: label.section,
                        quantity: qty,
                        actualLife,
                        percent: lifePercent(
                            String(card.part.partN || ''),
                            stock,
                            actualLife
                        ),
                        factoryLife,
                        movementId: writeOff.movementId,
                        totalCost: writeOff.totalCost,
                        unitPriceAvg: writeOff.unitPriceAvg,
                        costCategory: writeOff.costCategory,
                        economyAmount: writeOff.economyAmount,
                    },
                });
            }

            const neededParts: NeededPartLine[] =
                nextStatus === 'waiting_parts'
                    ? neededFilled.map((line) => {
                          const card = stock.find((item) => item.id === line.stockId);
                          const label = card ? chosenLabel(card, line) : null;
                          return {
                              stockId: line.stockId || '',
                              partN: String(card?.part.partN || line.query),
                              partName: label?.partName || line.name,
                              section: label?.section || '',
                              quantity: Number(line.quantity),
                          };
                      })
                    : [];

            if (!savedRef.current) {
                const entry = {
                    man,
                    status: nextStatus,
                    problem,
                    workDone,
                    notes,
                    counters,
                    replacedParts: writtenRef.current.map((item) => item.line),
                    neededParts,
                    date,
                };
                if (mode === 'create') {
                    savedRef.current = await createMaintenanceTicket({
                        printerId,
                        machine: machineName,
                        type,
                        openedBy: man,
                        entry,
                    });
                } else {
                    const appended = await appendMaintenanceEntry(
                        ticketId || '',
                        entry
                    );
                    savedRef.current = {
                        ticketId: ticketId || '',
                        entryId: appended.entryId,
                    };
                }
            }

            for (const item of writtenRef.current) {
                if (item.linked) continue;
                await addLinkedUsedPart({
                    partN: item.line.partN,
                    partName: item.line.partName,
                    quantity: item.line.quantity,
                    section: item.line.section,
                    man,
                    machine: machineName,
                    printerId,
                    date,
                    totalCost: item.line.totalCost,
                    unitPriceAvg: item.line.unitPriceAvg,
                    movementId: item.line.movementId,
                    costCategory: item.line.costCategory,
                    economyAmount: item.line.economyAmount,
                    factoryLife: item.line.factoryLife,
                    actualLife: item.line.actualLife,
                    percent: item.line.percent,
                    ticketId: savedRef.current.ticketId,
                    entryId: savedRef.current.entryId,
                });
                item.linked = true;
            }
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (!savedRef.current && writtenRef.current.some((item) => !item.linked)) {
                const parkedKeys: string[] = [];
                for (const item of writtenRef.current) {
                    if (item.linked) continue;
                    try {
                        await addLinkedUsedPart({
                            partN: item.line.partN,
                            partName: item.line.partName,
                            quantity: item.line.quantity,
                            section: item.line.section,
                            man,
                            machine: machineName,
                            printerId,
                            date,
                            totalCost: item.line.totalCost,
                            unitPriceAvg: item.line.unitPriceAvg,
                            movementId: item.line.movementId,
                            costCategory: item.line.costCategory,
                            economyAmount: item.line.economyAmount,
                            factoryLife: item.line.factoryLife,
                            actualLife: item.line.actualLife,
                            percent: item.line.percent,
                        });
                        item.linked = true;
                        parkedKeys.push(item.key);
                    } catch {
                        parkFailed = true;
                    }
                }
                parked = parkedKeys.length > 0 && !parkFailed;
                setReplaced((rows) =>
                    rows.filter((row) => !parkedKeys.includes(row.key))
                );
                writtenRef.current = writtenRef.current.filter((item) => !item.linked);
            }
            setSubmitError(
                parked
                    ? `${message}. Списание уже прошло и попало в прежние замены. Повторите заявку без этих деталей.`
                    : message || 'Не удалось сохранить заявку'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const shelfParts = useMemo(() => {
        const q = partQuery.trim().toLowerCase();
        const matches = (row: ShelfRow) =>
            !q ||
            row.partN.toLowerCase().includes(q) ||
            row.partName.toLowerCase().includes(q);
        const inside = shelfRows.filter(
            (row) => row.section === section && matches(row)
        );
        if (!q) return inside;
        const outside = shelfRows.filter(
            (row) =>
                row.section !== section && row.partN.toLowerCase().includes(q)
        );
        return [...inside, ...outside];
    }, [shelfRows, section, partQuery]);

    const activeLines = basket === 'replaced' ? replaced : needed;
    const chosen = new Set(
        activeLines
            .filter((line) => line.stockId)
            .map((line) => `${line.stockId}:${line.name.toLowerCase()}`)
    );

    const statusTone: Record<MaintenanceStatus, string> = {
        new: cls.toneNew,
        in_progress: cls.toneProgress,
        waiting_parts: cls.toneWait,
        done: cls.toneDone,
        paused: cls.tonePaused,
    };

    const renderSwitch = (
        label: string,
        value: string,
        items: readonly string[],
        onPickItem: (value: string) => void,
        caption: (value: string) => string,
        tone?: (item: string) => string
    ) => (
        <div className={cls.switch} role="radiogroup" aria-label={label}>
            {items.map((item) => (
                <button
                    key={item}
                    type="button"
                    aria-pressed={value === item}
                    className={[
                        value === item ? cls.switchOn : cls.switchBtn,
                        value === item ? tone?.(item) || '' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => onPickItem(item)}
                >
                    {caption(item)}
                </button>
            ))}
        </div>
    );

    const renderCartLine = (kind: 'replaced' | 'needed', line: LineDraft) => {
        const card = options.find((item) => item.id === line.stockId);
        return (
            <div className={cls.cartLine} key={line.key}>
                <strong className={cls.cartN}>{card?.partN || line.query}</strong>
                <span className={cls.cartName}>
                    {line.name || card?.partName || 'Деталь'}
                </span>
                <input
                    className={cls.cartQty}
                    type="number"
                    min={1}
                    step={1}
                    aria-label="Количество"
                    title="Количество"
                    value={line.quantity}
                    onChange={(e) =>
                        patchLine(kind, line.key, { quantity: e.target.value })
                    }
                />
                {kind === 'replaced' && (
                    <>
                        <button
                            type="button"
                            className={
                                line.noLife ? cls.noLifeOn : cls.noLifeBtn
                            }
                            aria-pressed={line.noLife}
                            aria-label="Нересурсная деталь"
                            title={
                                line.noLife
                                    ? 'Нересурсная: ресурс не нужен'
                                    : 'Отметить как нересурсную'
                            }
                            onClick={() =>
                                patchLine(kind, line.key, {
                                    noLife: !line.noLife,
                                })
                            }
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                            >
                                <path
                                    d="M3 11.5a5 5 0 1 1 10 0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M8 11.2 10.4 7.2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                />
                                {line.noLife && (
                                    <path
                                        d="M3.2 3.2 12.8 12.8"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.4"
                                        strokeLinecap="round"
                                    />
                                )}
                            </svg>
                        </button>
                        {!line.noLife && (
                            <input
                                className={cls.cartLife}
                                inputMode="numeric"
                                aria-label="Ресурс"
                                title="Пройденный ресурс"
                                placeholder="Ресурс"
                                value={line.life}
                                onChange={(e) =>
                                    patchLine(kind, line.key, {
                                        life: formatLifeWithCommas(
                                            e.target.value
                                        ),
                                    })
                                }
                            />
                        )}
                    </>
                )}
                <button
                    type="button"
                    className={cls.linkBtn}
                    onClick={() =>
                        (kind === 'replaced' ? setReplaced : setNeeded)((list) =>
                            list.filter((item) => item.key !== line.key)
                        )
                    }
                >
                    Убрать
                </button>
            </div>
        );
    };

    return (
        <div className={cls.sheet}>
            {toast && (
                <div
                    key={toast.id}
                    className={`${cls.toast} ${toast.note ? cls.toastNote : ''}`}
                    style={{ left: toast.left, top: toast.top }}
                    role="status"
                >
                    {toast.text}
                </div>
            )}
            <header className={cls.head}>
                <div className={cls.switches}>
                    {mode === 'create' &&
                        renderSwitch(
                            'Тип записи',
                            type,
                            MAINTENANCE_TYPES,
                            (value) => setType(value as MaintenanceType),
                            (value) =>
                                maintenanceTypeLabel(value as MaintenanceType)
                        )}
                    <span className={cls.statusGroup}>
                        <span className={cls.statusCaption}>Статус</span>
                        <div className={cls.switch} aria-label="Статус">
                            {MAINTENANCE_STATUSES.map((item) => (
                                <span
                                    key={item}
                                    className={[
                                        status === item ? cls.switchOn : cls.switchBtn,
                                        status === item ? statusTone[item] : '',
                                        cls.statusMark,
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    {maintenanceStatusLabel(item)}
                                </span>
                            ))}
                        </div>
                    </span>
                    <span className={cls.headMeta}>
                        <span className={cls.modeLabel}>
                            {mode === 'create' ? 'Новая заявка' : 'Новая запись'}
                        </span>
                        {mode === 'append' && ticketType && (
                            <span className={cls.typeLock}>
                                {maintenanceTypeLabel(ticketType)}
                            </span>
                        )}
                    </span>
                </div>
            </header>

            <div className={cls.strip}>
                <label className={cls.stripField}>
                    Проблема
                    <textarea
                        className={cls.area}
                        value={problem}
                        onChange={(e) => setProblem(e.target.value)}
                    />
                </label>
                <label className={cls.stripField}>
                    Выполненные работы
                    <textarea
                        className={cls.area}
                        value={workDone}
                        onChange={(e) => setWorkDone(e.target.value)}
                    />
                </label>
                <label className={cls.stripField}>
                    Замечания
                    <textarea
                        className={cls.area}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>
                <div className={cls.counterBox}>
                    {fields.map((field) => (
                        <label className={cls.stripCounter} key={field.key}>
                            {field.label}
                            <input
                                className={cls.input}
                                inputMode="numeric"
                                value={formatLifeWithCommas(
                                    getFieldValue(counters, field.key)
                                )}
                                onChange={(e) =>
                                    setCounters((current) =>
                                        setFieldValue(
                                            current,
                                            field.key,
                                            parseLifeExact(e.target.value)
                                        )
                                    )
                                }
                            />
                        </label>
                    ))}
                </div>
            </div>

            <div className={cls.shelf}>
                <div className={cls.picker}>
                {partsLoading ? (
                    <p className={cls.catalogEmpty}>Читаем склад…</p>
                ) : stock.length === 0 ? (
                    <p className={cls.catalogEmpty}>
                        Загрузите список секций и деталей
                    </p>
                ) : (
                <>
                <aside className={cls.sections} aria-label="Секции">
                    {sections.map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={
                                item === section ? cls.sectionOn : cls.sectionBtn
                            }
                            onClick={() => setSection(item)}
                        >
                            {item}
                        </button>
                    ))}
                </aside>

                <section className={cls.parts}>
                    <input
                        className={cls.input}
                        placeholder="Артикул или название"
                        value={partQuery}
                        onChange={(e) => setPartQuery(e.target.value)}
                    />
                    <div className={cls.partList}>
                        {partsLoading && <p className={cls.hint}>Читаем склад…</p>}
                        {!partsLoading && shelfParts.length === 0 && (
                            <p className={cls.hint}>В этой секции ничего не найдено</p>
                        )}
                        {shelfParts.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                className={`${cls.partRow} ${
                                    chosen.has(
                                        `${option.id}:${option.partName.toLowerCase()}`
                                    )
                                        ? cls.partOn
                                        : ''
                                }`}
                                onClick={(event) =>
                                    takePart(basket, option, event.currentTarget)
                                }
                            >
                                <span className={cls.partN}>{option.partN}</span>
                                <span className={cls.partName}>{option.partName}</span>
                                <span className={cls.partMeta}>
                                    {option.section !== section
                                        ? `${option.section} · `
                                        : ''}
                                    {option.qty} шт.
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={cls.linkBtn}
                        onClick={() => {
                            setAddingCard(true);
                            setNewCard({
                                partN: partQuery.trim().toUpperCase(),
                                partName: '',
                                section: section || sections[0] || '',
                            });
                        }}
                    >
                        Нет в списке — добавить в секцию
                    </button>
                    {addingCard && (
                        <div className={cls.addCard}>
                            <label className={cls.mini}>
                                Артикул
                                <input
                                    className={cls.input}
                                    value={newCard.partN}
                                    onChange={(e) =>
                                        setNewCard((card) => ({
                                            ...card,
                                            partN: e.target.value.toUpperCase(),
                                        }))
                                    }
                                />
                            </label>
                            <label className={cls.mini}>
                                Наименование
                                <input
                                    className={cls.input}
                                    value={newCard.partName}
                                    onChange={(e) =>
                                        setNewCard((card) => ({
                                            ...card,
                                            partName: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className={cls.mini}>
                                Секция
                                <select
                                    className={cls.input}
                                    value={newCard.section}
                                    onChange={(e) =>
                                        setNewCard((card) => ({
                                            ...card,
                                            section: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="">Выберите секцию</option>
                                    {sections.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className={cls.addActions}>
                                <button
                                    type="button"
                                    className={cls.secondary}
                                    disabled={submitting}
                                    onClick={createCard}
                                >
                                    Добавить на склад
                                </button>
                                <button
                                    type="button"
                                    className={cls.linkBtn}
                                    onClick={() => setAddingCard(false)}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    )}
                </section>
                </>
                )}
                </div>

                <aside className={cls.basket}>
                    <div
                        className={cls.basketMode}
                        role="radiogroup"
                        aria-label="Куда класть деталь"
                    >
                        <button
                            type="button"
                            className={
                                basket === 'replaced'
                                    ? cls.basketWriteOn
                                    : cls.basketModeBtn
                            }
                            aria-pressed={basket === 'replaced'}
                            onClick={() => setBasket('replaced')}
                        >
                            Списание
                        </button>
                        <button
                            type="button"
                            className={
                                basket === 'needed'
                                    ? cls.basketOrderOn
                                    : cls.basketModeBtn
                            }
                            aria-pressed={basket === 'needed'}
                            onClick={() => setBasket('needed')}
                        >
                            Заказ
                        </button>
                    </div>
                    <h3 className={cls.sectionTitle}>
                        {basket === 'replaced' ? 'Списание' : 'Заказ'}
                    </h3>
                    <p className={cls.hint}>
                        {basket === 'replaced'
                            ? 'Клик по детали кладёт её сюда. Со склада спишется при сохранении.'
                            : 'Это потребность. Со склада ничего не списывается.'}
                    </p>
                    {activeLines.length === 0 && (
                        <p className={cls.hint}>Пока пусто</p>
                    )}
                    <div className={cls.cart}>
                        {activeLines.map((line) => renderCartLine(basket, line))}
                    </div>
                </aside>
            </div>

            <footer className={cls.foot}>
                {submitError && <p className={cls.error}>{submitError}</p>}
                <button
                    type="button"
                    className={cls.cancel}
                    disabled={submitting}
                    onClick={() => {
                        if (!askMaintenanceLeave()) onClose();
                    }}
                >
                    Отмена
                </button>
                <button
                    type="button"
                    className={cls.primary}
                    disabled={submitting}
                    onClick={() => {
                        setStatusPick(status);
                        setStatusOpen(true);
                    }}
                >
                    {submitting ? '...' : 'Сохранить'}
                </button>
            </footer>
            {statusOpen && (
                <div className={cls.statusOverlay} role="presentation">
                    <div
                        className={cls.statusDialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="status-ask-title"
                    >
                        <h2 id="status-ask-title" className={cls.statusAskTitle}>
                            Какой статус записать?
                        </h2>
                        <div className={cls.statusAskList}>
                            {MAINTENANCE_STATUSES.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className={[
                                        statusPick === item
                                            ? cls.switchOn
                                            : cls.switchBtn,
                                        statusPick === item ? statusTone[item] : '',
                                        cls.statusAskBtn,
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    onClick={() => setStatusPick(item)}
                                >
                                    {maintenanceStatusLabel(item)}
                                </button>
                            ))}
                        </div>
                        <div className={cls.statusAskActions}>
                            <button
                                type="button"
                                className={cls.cancel}
                                onClick={() => setStatusOpen(false)}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className={cls.primary}
                                disabled={submitting}
                                onClick={() => save(statusPick)}
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceForm;

