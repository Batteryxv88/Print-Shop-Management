import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import cls from './PurchaseStock.module.scss';
import {
    useAppDispatch,
    useAppSelector,
    useParts,
    useToners,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { addPartToFirestore } from '../../../app/providers/StoreProvider/Store/PartSlice';
import { useAuth } from '../../../contexts/AuthContext';
import {
    purchaseStock,
    fetchKnownSuppliers,
    StockItemType,
} from '../../../services/stockAccounting';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { getColorsForModel } from '../../../shared/lib/printers/tonerColors';
import {
    DEFAULT_SECTION_ORDER,
    sortSections,
} from '../../../shared/lib/printers/sectionOrder';
import { formatPartLifeDisplay } from '../../../shared/lib/printers/parsePartLife';
import {
    CostCategory,
    inferPartCostCategory,
} from '../../../shared/lib/stock/costCategory';
import PartPicker, { PartPickerOption } from './PartPicker';

const OTHER_SECTION = 'Other';
const LAST_SUPPLIER_KEY = 'sl_last_purchase_supplier';
const LAST_SUPPLIER_TTL_MS = 30 * 60 * 1000; // 30 минут

const readRememberedSupplier = (): string => {
    try {
        const raw = localStorage.getItem(LAST_SUPPLIER_KEY);
        if (!raw) return '';
        const parsed = JSON.parse(raw) as { name?: string; at?: number };
        if (!parsed?.name || !parsed?.at) return '';
        if (Date.now() - parsed.at > LAST_SUPPLIER_TTL_MS) {
            localStorage.removeItem(LAST_SUPPLIER_KEY);
            return '';
        }
        return String(parsed.name).trim();
    } catch {
        return '';
    }
};

const rememberSupplier = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
        localStorage.setItem(
            LAST_SUPPLIER_KEY,
            JSON.stringify({ name: trimmed, at: Date.now() })
        );
    } catch {
        /* ignore quota / private mode */
    }
};

type TonerLine = {
    stockId: string;
    color: string;
    model: string;
    currentQty: number;
    qty: string;
    unitPrice: string;
};

type PartOption = PartPickerOption & {
    model: string;
    costCategory: CostCategory;
};

type NewPartDraft = {
    partName: string;
    section: string;
    partLife: string;
    installedQty: string;
};

const emptyDraft = (): NewPartDraft => ({
    partName: '',
    section: '',
    partLife: '',
    installedQty: '',
});

const Modal = ({
    isOpen,
    onClose,
    title,
    wide,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    wide?: boolean;
    children: React.ReactNode;
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={cls.modalOverlay}>
            <div
                className={`${cls.modalContent} ${wide ? cls.modalWide : ''}`}
                ref={modalRef}
            >
                <h2 className={cls.modalTitle}>{title}</h2>
                <button className={cls.closeButton} onClick={onClose}>
                    ×
                </button>
                {children}
            </div>
        </div>
    );
};

const SupplierSuggest = ({
    value,
    onChange,
    suppliers,
}: {
    value: string;
    onChange: (v: string) => void;
    suppliers: string[];
}) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const suggestions = useMemo(() => {
        const q = value.trim().toLowerCase();
        if (!q) return suppliers.slice(0, 8);
        return suppliers
            .filter((s) => s.toLowerCase().includes(q))
            .slice(0, 8);
    }, [value, suppliers]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (
                wrapRef.current &&
                !wrapRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const showList =
        open &&
        suggestions.length > 0 &&
        !(
            suggestions.length === 1 &&
            suggestions[0].toLowerCase() === value.trim().toLowerCase()
        );

    return (
        <div className={cls.suggestWrap} ref={wrapRef}>
            <input
                className={cls.input}
                value={value}
                autoComplete="off"
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Начните вводить…"
            />
            {showList && (
                <ul className={cls.suggestList}>
                    {suggestions.map((s) => (
                        <li key={s}>
                            <button
                                type="button"
                                className={cls.suggestItem}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onChange(s);
                                    setOpen(false);
                                }}
                            >
                                {s}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const todayLocalDate = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toIsoNoon = (date: string) =>
    date
        ? new Date(`${date}T12:00:00`).toISOString()
        : new Date().toISOString();

const normalizePartN = (value: string) => value.trim().toUpperCase();

type Props = {
    type: StockItemType;
    /** sidebar — на всю ширину сайдбара */
    layout?: 'default' | 'sidebar';
};

const PurchaseStock = ({ type, layout = 'default' }: Props) => {
    const { userData } = useAuth();
    const dispatch = useAppDispatch();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [supplier, setSupplier] = useState('');
    const [purchasedAt, setPurchasedAt] = useState(todayLocalDate);
    const [comment, setComment] = useState('');

    const [tonerLines, setTonerLines] = useState<TonerLine[]>([]);

    const [partQuery, setPartQuery] = useState('');
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [isNewPart, setIsNewPart] = useState(false);
    const [newPart, setNewPart] = useState<NewPartDraft>(emptyDraft);
    const [partCategory, setPartCategory] = useState<CostCategory>('consumable');
    const [partQty, setPartQty] = useState('1');
    const [partPrice, setPartPrice] = useState('');

    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const { partsArray } = useParts();
    const { tonersArr } = useToners();
    const { printers } = usePrinters();

    const partOptions = useMemo<PartOption[]>(() => {
        return partsArray
            .filter((item) => matchesModel(item.part?.model, storageModel))
            .map((item) => ({
                id: item.id,
                partN: String(item.part.partN || ''),
                partName: String(item.part.partName || ''),
                section: String(item.part.section || ''),
                model: item.part.model || storageModel || '',
                qty: Number(item.part.quantity) || 0,
                costCategory: inferPartCostCategory(item.part || {}),
            }))
            .sort((a, b) => a.partN.localeCompare(b.partN, 'ru'));
    }, [partsArray, storageModel]);

    const sectionOptions = useMemo(() => {
        const fromStock = partsArray
            .filter((item) => matchesModel(item.part?.model, storageModel))
            .map((item) => String(item.part?.section || ''))
            .filter(Boolean);
        const base = fromStock.length > 0 ? fromStock : DEFAULT_SECTION_ORDER;
        return sortSections([...base, OTHER_SECTION]);
    }, [partsArray, storageModel]);

    const selectedPart = useMemo(
        () => partOptions.find((o) => o.id === selectedPartId) || null,
        [partOptions, selectedPartId]
    );

    const exactMatch = useMemo(() => {
        const q = normalizePartN(partQuery);
        if (!q) return null;
        return partOptions.find((o) => o.partN.toUpperCase() === q) || null;
    }, [partOptions, partQuery]);

    // Точное совпадение артикула — выбираем автоматически
    useEffect(() => {
        if (exactMatch && !selectedPartId) {
            setSelectedPartId(exactMatch.id);
            setPartCategory(exactMatch.costCategory);
            setIsNewPart(false);
        }
    }, [exactMatch, selectedPartId]);

    const showNotFound =
        type === 'part' &&
        !selectedPart &&
        !isNewPart &&
        partQuery.trim().length >= 3;

    const modelColors = useMemo(
        () => getColorsForModel(printers, storageModel || ''),
        [printers, storageModel]
    );

    const buildTonerLines = useCallback((): TonerLine[] => {
        const byModel = tonersArr.filter((item) =>
            matchesModel(item.toner?.model, storageModel)
        );

        const ordered: typeof byModel = [];
        modelColors.forEach((color) => {
            byModel
                .filter((t) => t.toner.color === color)
                .forEach((t) => ordered.push(t));
        });
        byModel.forEach((t) => {
            if (!ordered.some((o) => o.id === t.id)) ordered.push(t);
        });

        return ordered.map((item) => ({
            stockId: item.id,
            color: item.toner.color,
            model: item.toner.model || storageModel || '',
            currentQty: Number(item.toner.qty) || 0,
            qty: '',
            unitPrice: '',
        }));
    }, [tonersArr, storageModel, modelColors]);

    const loadSuppliers = useCallback(async () => {
        try {
            setSuppliers(await fetchKnownSuppliers());
        } catch (err) {
            console.error(err);
        }
    }, []);

    const resetPartForm = () => {
        setPartQuery('');
        setSelectedPartId(null);
        setIsNewPart(false);
        setNewPart(emptyDraft());
        setPartCategory('consumable');
        setPartQty('1');
        setPartPrice('');
    };

    const openModal = () => {
        setSubmitError('');
        setSupplier(readRememberedSupplier());
        setComment('');
        setPurchasedAt(todayLocalDate());
        if (type === 'toner') {
            setTonerLines(buildTonerLines());
        } else {
            resetPartForm();
        }
        loadSuppliers();
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setSubmitError('');
        setIsModalOpen(false);
    };

    const handlePartQueryChange = (value: string) => {
        setPartQuery(value);
        setSubmitError('');
        if (selectedPart && normalizePartN(value) !== selectedPart.partN.toUpperCase()) {
            setSelectedPartId(null);
        }
    };

    const handlePickPart = (option: PartPickerOption) => {
        const full = partOptions.find((o) => o.id === option.id);
        setPartQuery(option.partN);
        setSelectedPartId(option.id);
        setIsNewPart(false);
        if (full) setPartCategory(full.costCategory);
    };

    const startNewPart = () => {
        setIsNewPart(true);
        setSelectedPartId(null);
        setPartQuery(normalizePartN(partQuery));
        setNewPart({ ...emptyDraft(), section: '' });
    };

    const cancelNewPart = () => {
        setIsNewPart(false);
        setNewPart(emptyDraft());
    };

    const updateTonerLine = (
        stockId: string,
        field: 'qty' | 'unitPrice',
        value: string
    ) => {
        setTonerLines((prev) =>
            prev.map((line) =>
                line.stockId === stockId ? { ...line, [field]: value } : line
            )
        );
    };

    const tonerTotal = useMemo(
        () =>
            tonerLines.reduce((sum, line) => {
                const qty = Number(line.qty) || 0;
                const price = Number(line.unitPrice) || 0;
                if (qty <= 0) return sum;
                return sum + qty * price;
            }, 0),
        [tonerLines]
    );

    const filledTonerLines = useMemo(
        () =>
            tonerLines.filter((line) => {
                const qty = Number(line.qty);
                return Number.isFinite(qty) && qty > 0;
            }),
        [tonerLines]
    );

    const onSubmitToners = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        if (filledTonerLines.length === 0) {
            setSubmitError('Укажите количество хотя бы для одного цвета');
            return;
        }

        for (const line of filledTonerLines) {
            const price = Number(line.unitPrice);
            if (!Number.isFinite(price) || price < 0) {
                setSubmitError(`Укажите цену для цвета ${line.color} (или 0)`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const at = toIsoNoon(purchasedAt);
            // Последовательно: у каждого цвета свой currentStockQty
            for (const line of filledTonerLines) {
                await purchaseStock({
                    type: 'toner',
                    stockId: line.stockId,
                    color: line.color,
                    model: line.model,
                    costCategory: 'toner',
                    qty: Number(line.qty),
                    unitPrice: Number(line.unitPrice) || 0,
                    purchasedAt: at,
                    supplier: supplier.trim(),
                    comment: comment.trim(),
                    createdBy: userData?.displayName || '',
                    currentStockQty: line.currentQty,
                });
            }
            rememberSupplier(supplier);
            handleClose();
        } catch (err: any) {
            setSubmitError(err?.message || 'Ошибка прихода');
        } finally {
            setSubmitting(false);
        }
    };

    const onSubmitPart = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        const qty = Number(partQty);
        const price = Number(partPrice);
        const partN = normalizePartN(partQuery);

        if (!selectedPart && !isNewPart) {
            setSubmitError(
                partN
                    ? 'Выберите деталь из списка или добавьте новую'
                    : 'Введите артикул детали'
            );
            return;
        }
        if (!(qty >= 1)) {
            setSubmitError('Количество — минимум 1');
            return;
        }
        if (partPrice === '' || !Number.isFinite(price) || price < 0) {
            setSubmitError('Укажите цену (можно 0)');
            return;
        }
        if (isNewPart) {
            if (partN.length < 3) {
                setSubmitError('Артикул — минимум 3 символа');
                return;
            }
            if (newPart.partName.trim().length < 2) {
                setSubmitError('Укажите наименование детали');
                return;
            }
            if (!newPart.section) {
                setSubmitError('Выберите секцию');
                return;
            }
        }

        setSubmitting(true);
        try {
            let target: { id: string; partN: string; partName: string; model: string; qty: number };

            if (isNewPart) {
                const model = storageModel || '';
                const partLife =
                    partCategory === 'consumable'
                        ? formatPartLifeDisplay(newPart.partLife) || newPart.partLife.trim()
                        : '';
                const created = await dispatch(
                    addPartToFirestore({
                        partN,
                        partName: newPart.partName.trim(),
                        quantity: 0,
                        partLife,
                        section: newPart.section,
                        installedQty: Number(newPart.installedQty) || 0,
                        source: 'manual',
                        costCategory: partCategory,
                        ...(model ? { model } : {}),
                    })
                ).unwrap();
                target = {
                    id: created.id,
                    partN,
                    partName: newPart.partName.trim(),
                    model,
                    qty: 0,
                };
            } else {
                target = selectedPart!;
            }

            await purchaseStock({
                type: 'part',
                stockId: target.id,
                partN: target.partN,
                partName: target.partName,
                model: target.model,
                costCategory: partCategory,
                qty,
                unitPrice: price,
                purchasedAt: toIsoNoon(purchasedAt),
                supplier: supplier.trim(),
                comment: comment.trim(),
                createdBy: userData?.displayName || '',
                currentStockQty: target.qty,
            });

            rememberSupplier(supplier);
            handleClose();
        } catch (err: any) {
            setSubmitError(err?.message || 'Ошибка прихода');
        } finally {
            setSubmitting(false);
        }
    };

    const partTotal = (Number(partQty) || 0) * (Number(partPrice) || 0);

    const commonFields = (
        <>
            <div className={cls.box}>
                <label className={cls.label}>Дата закупки</label>
                <input
                    className={cls.input}
                    type="date"
                    value={purchasedAt}
                    onChange={(e) => setPurchasedAt(e.target.value)}
                    required
                />
            </div>

            <div className={cls.box}>
                <label className={cls.label}>Поставщик</label>
                <SupplierSuggest
                    value={supplier}
                    onChange={setSupplier}
                    suppliers={suppliers}
                />
            </div>

            <div className={cls.box}>
                <label className={cls.label}>Комментарий</label>
                <input
                    className={cls.input}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
            </div>
        </>
    );

    return (
        <>
            <button
                className={
                    layout === 'sidebar'
                        ? cls.openModalButtonSidebar
                        : cls.openModalButton
                }
                onClick={openModal}
                type="button"
            >
                <span className={cls.buttonText}>Приход</span>
            </button>

            <Modal
                isOpen={isModalOpen}
                onClose={handleClose}
                title={type === 'part' ? 'Приход деталей' : 'Приход тонеров'}
                wide
            >
                {type === 'toner' ? (
                    <form className={cls.form} onSubmit={onSubmitToners}>
                        <p className={cls.hint}>
                            Введите количество и цену по нужным цветам — пустые
                            строки пропускаются.
                            {storageModel ? ` Модель: ${storageModel}` : ''}
                        </p>

                        {tonerLines.length === 0 ? (
                            <p className={cls.hint}>
                                Нет тонеров для этой модели на складе.
                            </p>
                        ) : (
                            <div className={cls.tonerTable}>
                                <div className={cls.tonerHead}>
                                    <span>Цвет</span>
                                    <span>Остаток</span>
                                    <span>Кол-во</span>
                                    <span>Цена, ₽</span>
                                    <span>Сумма</span>
                                </div>
                                {tonerLines.map((line) => {
                                    const qty = Number(line.qty) || 0;
                                    const price = Number(line.unitPrice) || 0;
                                    const rowSum = qty > 0 ? qty * price : 0;
                                    return (
                                        <div className={cls.tonerRow} key={line.stockId}>
                                            <span className={cls.colorCell}>{line.color}</span>
                                            <span className={cls.muted}>{line.currentQty}</span>
                                            <input
                                                className={cls.input}
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="0"
                                                value={line.qty}
                                                onChange={(e) =>
                                                    updateTonerLine(line.stockId, 'qty', e.target.value)
                                                }
                                            />
                                            <input
                                                className={cls.input}
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                placeholder="0"
                                                value={line.unitPrice}
                                                onChange={(e) =>
                                                    updateTonerLine(line.stockId, 'unitPrice', e.target.value)
                                                }
                                            />
                                            <span className={cls.rowSum}>
                                                {rowSum > 0
                                                    ? rowSum.toLocaleString('ru-RU', {
                                                          maximumFractionDigits: 2,
                                                      })
                                                    : '—'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {commonFields}

                        <p className={cls.totalPreview}>
                            Итого:{' '}
                            {tonerTotal.toLocaleString('ru-RU', {
                                maximumFractionDigits: 2,
                            })}{' '}
                            ₽ · позиций: {filledTonerLines.length}
                        </p>

                        <button
                            className={cls.button}
                            type="submit"
                            disabled={submitting || tonerLines.length === 0}
                        >
                            {submitting ? '...' : 'Оформить'}
                        </button>
                    </form>
                ) : (
                    <form className={cls.form} onSubmit={onSubmitPart}>
                        <p className={cls.hint}>
                            Начните вводить артикул — подходящие детали появятся
                            в подсказках. Стрелка справа открывает весь список.
                            {storageModel ? ` Модель: ${storageModel}` : ''}
                        </p>

                        <div className={cls.box}>
                            <label className={cls.label}>Деталь</label>
                            <PartPicker
                                query={partQuery}
                                onQueryChange={handlePartQueryChange}
                                options={partOptions}
                                selectedId={selectedPartId}
                                onSelect={handlePickPart}
                            />

                            {selectedPart && (
                                <div className={cls.selectedCard}>
                                    <span className={cls.selectedCheck}>✓</span>
                                    <div className={cls.selectedInfo}>
                                        <strong>{selectedPart.partName}</strong>
                                        <span>
                                            {selectedPart.section || '—'} · на складе{' '}
                                            {selectedPart.qty} шт.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {showNotFound && (
                                <div className={cls.notFound}>
                                    <div>
                                        <strong>
                                            Детали «{normalizePartN(partQuery)}» нет в
                                            списке
                                        </strong>
                                        <span>
                                            Можно добавить её на склад прямо сейчас.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className={cls.notFoundButton}
                                        onClick={startNewPart}
                                    >
                                        + Добавить новую
                                    </button>
                                </div>
                            )}
                        </div>

                        {isNewPart && (
                            <div className={cls.newPartPanel}>
                                <div className={cls.newPartHead}>
                                    <span>Новая деталь · {normalizePartN(partQuery)}</span>
                                    <button
                                        type="button"
                                        className={cls.linkButton}
                                        onClick={cancelNewPart}
                                    >
                                        Отмена
                                    </button>
                                </div>

                                <div className={cls.box}>
                                    <label className={cls.label}>Наименование</label>
                                    <input
                                        className={cls.input}
                                        value={newPart.partName}
                                        onChange={(e) =>
                                            setNewPart((d) => ({ ...d, partName: e.target.value }))
                                        }
                                        autoFocus
                                    />
                                </div>

                                <div className={cls.box}>
                                    <label className={cls.label}>Секция</label>
                                    <select
                                        className={cls.input}
                                        value={newPart.section}
                                        onChange={(e) =>
                                            setNewPart((d) => ({ ...d, section: e.target.value }))
                                        }
                                    >
                                        <option value="">Выберите секцию</option>
                                        {sectionOptions.map((s) => (
                                            <option key={s} value={s}>
                                                {s === OTHER_SECTION ? 'Other — прочее' : s}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={cls.box}>
                                    <label className={cls.label}>Кол-во в аппарате (Qty)</label>
                                    <input
                                        className={cls.input}
                                        type="number"
                                        min={0}
                                        value={newPart.installedQty}
                                        placeholder="0"
                                        onChange={(e) =>
                                            setNewPart((d) => ({ ...d, installedQty: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {(selectedPart || isNewPart) && (
                            <div className={cls.box}>
                                <label className={cls.label}>Тип позиции</label>
                                <div className={cls.segment}>
                                    <button
                                        type="button"
                                        className={`${cls.segmentBtn} ${
                                            partCategory === 'spare' ? cls.segmentActive : ''
                                        }`}
                                        onClick={() => setPartCategory('spare')}
                                    >
                                        Запчасти
                                        <span className={cls.segmentHint}>без ресурса</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${cls.segmentBtn} ${
                                            partCategory === 'consumable' ? cls.segmentActive : ''
                                        }`}
                                        onClick={() => setPartCategory('consumable')}
                                    >
                                        Расходка
                                        <span className={cls.segmentHint}>с ресурсом</span>
                                    </button>
                                </div>
                                {isNewPart && partCategory === 'consumable' && (
                                    <input
                                        className={cls.input}
                                        value={newPart.partLife}
                                        placeholder="Заводской ресурс, например 30K"
                                        onChange={(e) =>
                                            setNewPart((d) => ({ ...d, partLife: e.target.value }))
                                        }
                                    />
                                )}
                                <p className={cls.hint}>
                                    Расходка участвует в «Экономия / Перерасход» по
                                    фактическому ресурсу при замене.
                                </p>
                            </div>
                        )}

                        <div className={cls.row2}>
                            <div className={cls.box}>
                                <label className={cls.label}>Количество</label>
                                <input
                                    className={cls.input}
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={partQty}
                                    onChange={(e) => setPartQty(e.target.value)}
                                />
                            </div>
                            <div className={cls.box}>
                                <label className={cls.label}>Цена за шт., ₽</label>
                                <input
                                    className={cls.input}
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="0"
                                    value={partPrice}
                                    onChange={(e) => setPartPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        {commonFields}

                        <p className={cls.totalPreview}>
                            Сумма партии:{' '}
                            {partTotal.toLocaleString('ru-RU', {
                                maximumFractionDigits: 2,
                            })}{' '}
                            ₽
                        </p>

                        <button
                            className={cls.button}
                            type="submit"
                            disabled={submitting || (!selectedPart && !isNewPart)}
                        >
                            {submitting ? '...' : 'Оформить'}
                        </button>
                    </form>
                )}

                <div className={`${cls.errMessage} ${submitError ? cls.visible : ''}`}>
                    {submitError}
                </div>
            </Modal>
        </>
    );
};

export default PurchaseStock;
