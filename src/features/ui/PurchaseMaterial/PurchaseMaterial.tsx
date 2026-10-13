import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import cls from './PurchaseMaterial.module.scss';
import {
    useAppSelector,
    useMaterials,
    useLaminations,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
    purchaseStock,
    fetchKnownSuppliers,
} from '../../../services/stockAccounting';
import {
    Material,
    PaperForm,
    createMaterial,
} from '../../../services/materials';
import { Lamination, createLamination } from '../../../services/laminations';
import {
    MaterialCatalog,
    fetchMaterialCatalog,
    addCatalogValue,
    MaterialCatalogKey,
} from '../../../services/materialCatalog';
import { PaperFormMode } from '../../../services/appSettings';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

type Kind = 'paper' | 'lamination';

type Props = {
    kind: Kind;
    layout?: 'sidebar' | 'inline';
};

const LAST_SUPPLIER_KEY = 'sl_last_purchase_supplier';

type SuggestItem = { id: string; label: string; hint?: string };

const Typeahead = ({
    label,
    value,
    onChange,
    items,
    placeholder,
    onPick,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    items: SuggestItem[];
    placeholder?: string;
    onPick?: (item: SuggestItem) => void;
}) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const suggestions = useMemo(() => {
        const q = value.trim().toLowerCase();
        if (!q) return items.slice(0, 10);
        return items
            .filter(
                (i) =>
                    i.label.toLowerCase().includes(q) ||
                    (i.hint || '').toLowerCase().includes(q)
            )
            .slice(0, 10);
    }, [value, items]);

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

    const exact =
        suggestions.length === 1 &&
        suggestions[0].label.toLowerCase() === value.trim().toLowerCase();
    const showList = open && suggestions.length > 0 && !exact;

    return (
        <label className={cls.field}>
            <span>{label}</span>
            <div className={cls.suggestWrap} ref={wrapRef}>
                <input
                    value={value}
                    autoComplete="off"
                    placeholder={placeholder || 'Начните вводить…'}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                />
                {showList && (
                    <ul className={cls.suggestList}>
                        {suggestions.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    className={cls.suggestItem}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onChange(s.label);
                                        onPick?.(s);
                                        setOpen(false);
                                    }}
                                >
                                    <span>{s.label}</span>
                                    {s.hint ? (
                                        <span className={cls.suggestHint}>
                                            {s.hint}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </label>
    );
};

const Combobox = ({
    label,
    value,
    options,
    onChange,
    onAdd,
    placeholder,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
    onAdd?: (v: string) => Promise<void>;
    placeholder?: string;
}) => {
    const listId = `opt-${label.replace(/\s+/g, '-')}`;
    return (
        <label className={cls.field}>
            <span>{label}</span>
            <div className={cls.addRow}>
                <input
                    list={listId}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || 'Выберите или введите…'}
                />
                {onAdd ? (
                    <button
                        type="button"
                        className={cls.miniBtn}
                        title="Добавить в справочник"
                        onClick={async () => {
                            const v = value.trim();
                            if (!v) return;
                            await onAdd(v);
                        }}
                    >
                        +
                    </button>
                ) : null}
            </div>
            <datalist id={listId}>
                {options.map((o) => (
                    <option key={o} value={o} />
                ))}
            </datalist>
        </label>
    );
};

const PurchaseMaterial = ({ kind, layout = 'sidebar' }: Props) => {
    const { userData } = useAuth();
    const { materials } = useMaterials();
    const { laminations } = useLaminations();
    const paperFormMode = useAppSelector(
        (s) => s.appSettings.paperFormMode
    ) as PaperFormMode;

    const [open, setOpen] = useState(false);
    const [catalog, setCatalog] = useState<MaterialCatalog | null>(null);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [stockId, setStockId] = useState('');
    const [nameQuery, setNameQuery] = useState('');
    const [form, setForm] = useState<PaperForm>('roll');
    const [name, setName] = useState('');
    const [materialType, setMaterialType] = useState('');
    const [subtype, setSubtype] = useState('');
    const [thickness, setThickness] = useState('');
    const [adhesive, setAdhesive] = useState('');
    const [metersPerRoll, setMetersPerRoll] = useState('');
    const [density, setDensity] = useState('');
    const [format, setFormat] = useState('');
    const [color, setColor] = useState('');
    const [coating, setCoating] = useState('');
    const [note, setNote] = useState('');
    const [qty, setQty] = useState('1');
    const [unitPrice, setUnitPrice] = useState('');
    const [supplier, setSupplier] = useState('');
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [okModal, setOkModal] = useState(false);

    const allowedForms = useMemo((): PaperForm[] => {
        if (kind !== 'paper') return [];
        if (paperFormMode === 'sheet') return ['sheet'];
        if (paperFormMode === 'roll') return ['roll'];
        return ['roll', 'sheet'];
    }, [kind, paperFormMode]);

    const paperItems = useMemo(
        () =>
            materials.filter(
                (m) =>
                    m.status !== 'defective' &&
                    (paperFormMode === 'both' || m.form === paperFormMode)
            ),
        [materials, paperFormMode]
    );

    const laminationItems = useMemo(
        () => laminations.filter((l) => l.status !== 'defective'),
        [laminations]
    );

    const nameSuggestItems = useMemo((): SuggestItem[] => {
        if (kind === 'paper') {
            return paperItems.map((m) => ({
                id: m.id,
                label: m.name || m.type,
                hint: `${m.form === 'sheet' ? 'лист' : 'рулон'} · ${m.qty} шт.`,
            }));
        }
        return laminationItems.map((l) => ({
            id: l.id,
            label: l.name || l.title || l.type,
            hint: `${l.qty} шт.`,
        }));
    }, [kind, paperItems, laminationItems]);

    const supplierSuggestItems = useMemo(
        (): SuggestItem[] =>
            suppliers.map((s) => ({ id: s, label: s })),
        [suppliers]
    );

    useEffect(() => {
        if (!open) return;
        fetchMaterialCatalog().then(setCatalog).catch(() => setCatalog(null));
        fetchKnownSuppliers()
            .then(setSuppliers)
            .catch(() => setSuppliers([]));
        try {
            const raw = localStorage.getItem(LAST_SUPPLIER_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as { name?: string };
                if (parsed?.name) setSupplier(parsed.name);
            }
        } catch {
            /* ignore */
        }
        if (allowedForms.length === 1) setForm(allowedForms[0]);
    }, [open, allowedForms]);

    const reset = () => {
        setMode('existing');
        setStockId('');
        setNameQuery('');
        setName('');
        setMaterialType('');
        setSubtype('');
        setThickness('');
        setAdhesive('');
        setMetersPerRoll('');
        setDensity('');
        setFormat('');
        setColor('');
        setCoating('');
        setNote('');
        setQty('1');
        setUnitPrice('');
        setError('');
    };

    const addToCatalog = async (key: MaterialCatalogKey, value: string) => {
        const next = await addCatalogValue(key, value);
        setCatalog(next);
    };

    const handleSubmit = async () => {
        setError('');
        const q = Number(qty);
        const price = Number(unitPrice);
        if (!(q > 0)) {
            setError('Укажите количество');
            return;
        }
        if (!(price >= 0) || unitPrice === '') {
            setError('Укажите цену');
            return;
        }

        setBusy(true);
        try {
            let targetId = stockId;
            let currentQty = 0;
            let partName = '';

            if (kind === 'paper') {
                if (mode === 'new') {
                    if (!name.trim()) throw new Error('Укажите название');
                    const created = await createMaterial({
                        name: name.trim(),
                        type: name.trim(),
                        form,
                        materialType,
                        subtype,
                        thickness,
                        note,
                        adhesive: form === 'roll' ? adhesive : undefined,
                        metersPerRoll:
                            form === 'roll'
                                ? Number(metersPerRoll) || 0
                                : undefined,
                        density: form === 'sheet' ? density : undefined,
                        format: form === 'sheet' ? format : undefined,
                        color: form === 'sheet' ? color : undefined,
                        coating: form === 'sheet' ? coating : undefined,
                        qty: 0,
                        status: 'new',
                    });
                    targetId = created.id;
                    currentQty = 0;
                    partName = created.material.name;
                } else {
                    const qName = nameQuery.trim().toLowerCase();
                    const item =
                        paperItems.find((m) => m.id === stockId) ||
                        paperItems.find(
                            (m) =>
                                (m.name || m.type || '').toLowerCase() ===
                                qName
                        );
                    if (!item) {
                        throw new Error(
                            'Выберите наименование бумаги из списка'
                        );
                    }
                    targetId = item.id;
                    currentQty = Number(item.qty) || 0;
                    partName = item.name || item.type;
                }
            } else {
                if (mode === 'new') {
                    if (!name.trim()) throw new Error('Укажите название');
                    const created = await createLamination({
                        name: name.trim(),
                        type: materialType || name.trim(),
                        subtype,
                        thickness,
                        note,
                        qty: 0,
                        status: 'new',
                    });
                    targetId = created.id;
                    currentQty = 0;
                    partName = created.lamination.name;
                } else {
                    const qName = nameQuery.trim().toLowerCase();
                    const item =
                        laminationItems.find((l) => l.id === stockId) ||
                        laminationItems.find(
                            (l) =>
                                (
                                    l.name ||
                                    l.title ||
                                    l.type ||
                                    ''
                                ).toLowerCase() === qName
                        );
                    if (!item) {
                        throw new Error(
                            'Выберите наименование из списка'
                        );
                    }
                    targetId = item.id;
                    currentQty = Number(item.qty) || 0;
                    partName = item.name || item.title || item.type;
                }
            }

            await purchaseStock({
                type: kind,
                stockId: targetId,
                partName,
                partN: partName,
                costCategory: kind === 'paper' ? 'paper' : 'lamination',
                qty: q,
                unitPrice: price,
                supplier: supplier.trim(),
                comment: note.trim(),
                createdBy: userData?.displayName || '',
                currentStockQty: currentQty,
            });

            if (supplier.trim()) {
                try {
                    localStorage.setItem(
                        LAST_SUPPLIER_KEY,
                        JSON.stringify({
                            name: supplier.trim(),
                            at: Date.now(),
                        })
                    );
                } catch {
                    /* ignore */
                }
            }

            reset();
            setOpen(false);
            setOkModal(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const title = kind === 'paper' ? 'Приход бумаги' : 'Приход ламинации';

    return (
        <>
            <button
                type="button"
                className={classNames(
                    cls.openBtn,
                    layout === 'inline' && cls.openBtnInline
                )}
                onClick={() => setOpen(true)}
            >
                Приход
            </button>

            {open && (
                <div className={cls.overlay}>
                    <div className={cls.modal}>
                        <header className={cls.header}>
                            <h3>{title}</h3>
                            <button
                                type="button"
                                className={cls.close}
                                onClick={() => {
                                    reset();
                                    setOpen(false);
                                }}
                            >
                                ×
                            </button>
                        </header>

                        <div className={cls.tabs}>
                            <button
                                type="button"
                                className={
                                    mode === 'existing'
                                        ? cls.tabActive
                                        : cls.tab
                                }
                                onClick={() => setMode('existing')}
                            >
                                Есть на складе
                            </button>
                            <button
                                type="button"
                                className={
                                    mode === 'new' ? cls.tabActive : cls.tab
                                }
                                onClick={() => setMode('new')}
                            >
                                Новый тип
                            </button>
                        </div>

                        <div className={cls.body}>
                            {mode === 'existing' ? (
                                <Typeahead
                                    label="Наименование"
                                    value={nameQuery}
                                    items={nameSuggestItems}
                                    placeholder="Начните вводить название…"
                                    onChange={(v) => {
                                        setNameQuery(v);
                                        setStockId('');
                                    }}
                                    onPick={(item) => {
                                        setStockId(item.id);
                                        setNameQuery(item.label);
                                    }}
                                />
                            ) : (
                                <>
                                    {kind === 'paper' &&
                                        allowedForms.length > 1 && (
                                            <div className={cls.formSwitch}>
                                                {allowedForms.map((f) => (
                                                    <button
                                                        key={f}
                                                        type="button"
                                                        className={
                                                            form === f
                                                                ? cls.tabActive
                                                                : cls.tab
                                                        }
                                                        onClick={() =>
                                                            setForm(f)
                                                        }
                                                    >
                                                        {f === 'roll'
                                                            ? 'Рулон'
                                                            : 'Лист'}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                    <label className={cls.field}>
                                        <span>Название</span>
                                        <input
                                            value={name}
                                            onChange={(e) =>
                                                setName(e.target.value)
                                            }
                                        />
                                    </label>

                                    {kind === 'paper' ? (
                                        <>
                                            <Combobox
                                                label="Тип"
                                                value={materialType}
                                                options={
                                                    catalog?.paperTypes || []
                                                }
                                                onChange={setMaterialType}
                                                onAdd={(v) =>
                                                    addToCatalog(
                                                        'paperTypes',
                                                        v
                                                    )
                                                }
                                                placeholder="Бумага / Плёнка / иное"
                                            />
                                            <Combobox
                                                label="Толщина"
                                                value={thickness}
                                                options={
                                                    catalog?.thicknesses || []
                                                }
                                                onChange={setThickness}
                                                onAdd={(v) =>
                                                    addToCatalog(
                                                        'thicknesses',
                                                        v
                                                    )
                                                }
                                            />
                                            {form === 'roll' ? (
                                                <>
                                                    <Combobox
                                                        label="Свойства"
                                                        value={subtype}
                                                        options={
                                                            catalog?.paperSubtypes ||
                                                            []
                                                        }
                                                        onChange={setSubtype}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'paperSubtypes',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <Combobox
                                                        label="Клей"
                                                        value={adhesive}
                                                        options={
                                                            catalog?.adhesives ||
                                                            []
                                                        }
                                                        onChange={setAdhesive}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'adhesives',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <label className={cls.field}>
                                                        <span>Метры в рулоне</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={metersPerRoll}
                                                            onChange={(e) =>
                                                                setMetersPerRoll(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                </>
                                            ) : (
                                                <>
                                                    <Combobox
                                                        label="Подтип"
                                                        value={subtype}
                                                        options={
                                                            catalog?.paperSubtypes ||
                                                            []
                                                        }
                                                        onChange={setSubtype}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'paperSubtypes',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <Combobox
                                                        label="Плотность"
                                                        value={density}
                                                        options={
                                                            catalog?.densities ||
                                                            []
                                                        }
                                                        onChange={setDensity}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'densities',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <Combobox
                                                        label="Формат"
                                                        value={format}
                                                        options={
                                                            catalog?.formats ||
                                                            []
                                                        }
                                                        onChange={setFormat}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'formats',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <Combobox
                                                        label="Цвет"
                                                        value={color}
                                                        options={
                                                            catalog?.colors ||
                                                            []
                                                        }
                                                        onChange={setColor}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'colors',
                                                                v
                                                            )
                                                        }
                                                    />
                                                    <Combobox
                                                        label="Покрытие"
                                                        value={coating}
                                                        options={
                                                            catalog?.coatings ||
                                                            []
                                                        }
                                                        onChange={setCoating}
                                                        onAdd={(v) =>
                                                            addToCatalog(
                                                                'coatings',
                                                                v
                                                            )
                                                        }
                                                    />
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Combobox
                                                label="Тип"
                                                value={materialType}
                                                options={
                                                    catalog?.laminationTypes ||
                                                    []
                                                }
                                                onChange={setMaterialType}
                                                onAdd={(v) =>
                                                    addToCatalog(
                                                        'laminationTypes',
                                                        v
                                                    )
                                                }
                                            />
                                            <Combobox
                                                label="Подтип"
                                                value={subtype}
                                                options={
                                                    catalog?.laminationSubtypes ||
                                                    []
                                                }
                                                onChange={setSubtype}
                                                onAdd={(v) =>
                                                    addToCatalog(
                                                        'laminationSubtypes',
                                                        v
                                                    )
                                                }
                                            />
                                            <Combobox
                                                label="Толщина"
                                                value={thickness}
                                                options={
                                                    catalog?.thicknesses || []
                                                }
                                                onChange={setThickness}
                                                onAdd={(v) =>
                                                    addToCatalog(
                                                        'thicknesses',
                                                        v
                                                    )
                                                }
                                            />
                                        </>
                                    )}

                                    <label className={cls.field}>
                                        <span>Примечание</span>
                                        <input
                                            value={note}
                                            onChange={(e) =>
                                                setNote(e.target.value)
                                            }
                                        />
                                    </label>
                                </>
                            )}

                            <div className={cls.row}>
                                <label className={cls.field}>
                                    <span>Количество</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={qty}
                                        onChange={(e) => setQty(e.target.value)}
                                    />
                                </label>
                                <label className={cls.field}>
                                    <span>Цена, ₽</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={unitPrice}
                                        onChange={(e) =>
                                            setUnitPrice(e.target.value)
                                        }
                                    />
                                </label>
                            </div>

                            <Typeahead
                                label="Поставщик"
                                value={supplier}
                                items={supplierSuggestItems}
                                placeholder="Начните вводить…"
                                onChange={setSupplier}
                            />

                            {mode === 'existing' && (
                                <label className={cls.field}>
                                    <span>Примечание</span>
                                    <input
                                        value={note}
                                        onChange={(e) =>
                                            setNote(e.target.value)
                                        }
                                    />
                                </label>
                            )}

                            {error && (
                                <p className={cls.error}>{error}</p>
                            )}
                        </div>

                        <footer className={cls.footer}>
                            <button
                                type="button"
                                className={cls.cancel}
                                onClick={() => {
                                    reset();
                                    setOpen(false);
                                }}
                                disabled={busy}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className={cls.submit}
                                onClick={handleSubmit}
                                disabled={busy}
                            >
                                {busy ? 'Сохранение…' : 'Оформить приход'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            <NotificationModal
                isOpen={okModal}
                onClose={() => setOkModal(false)}
                title="Приход оформлен"
                message="Позиция пополнена, партия FIFO записана."
                type="success"
            />
        </>
    );
};

export default PurchaseMaterial;
