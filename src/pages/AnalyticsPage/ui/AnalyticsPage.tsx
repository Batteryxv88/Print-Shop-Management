import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import {
    useAppDispatch,
    useAppSelector,
    usePrinters,
    useTonerHistory,
    useUsedParts,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { usageEventsToMovements } from '../../../shared/lib/stock/usageEventsToMovements';
import {
    fetchMovementsInRange,
    fetchRecentMovements,
    fetchOpenLots,
    isActiveCostMovement,
    stockValueFromLots,
    StockLot,
    StockMovement,
} from '../../../services/stockAccounting';
import {
    fetchAllCounterReadings,
    type CounterReadingRecord,
} from '../../../services/counterReadings';
import {
    COST_CATEGORIES,
    COST_CATEGORY_COLORS,
    COST_CATEGORY_LABELS,
    CostCategory,
} from '../../../shared/lib/stock/costCategory';
import {
    buildPrinterAnalytics,
    collectUnattachedMovements,
} from '../../../shared/lib/stock/buildPrinterAnalytics';
import {
    buildTonerUnits,
    sortedTonerColors,
    totalTonerUnits,
} from '../../../shared/lib/stock/buildTonerUnits';
import { getTonerSwatchColor } from '../../../shared/lib/printers/tonerColors';
import {
    buildMaterialsSummary,
    type MaterialKind,
} from '../../../shared/lib/stock/buildMaterialsSummary';
import {
    buildPrinterMonthlyCosts,
    costSeriesHasData,
    type CostMode,
    type PrinterCostMonthRow,
} from '../../../shared/lib/stock/buildPrinterMonthlyCosts';
import { buildClickCosts } from '../../../shared/lib/stock/buildClickCosts';
import { exportAnalyticsExcel } from '../../../shared/lib/stock/exportAnalyticsExcel';
import {
    buildPrintVolumeSeries,
    PRINTER_LINE_COLORS,
    type PrintVolumeMonthRow,
} from '../../../shared/lib/counterReading/buildPrintVolume';
import { specialColorLabel } from '../../../shared/lib/counterReading/fields';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';
import cls from './AnalyticsPage.module.scss';

const pad = (n: number) => String(n).padStart(2, '0');

const startOfDayIso = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toISOString();

const endOfDayIso = (dateStr: string) =>
    new Date(`${dateStr}T23:59:59.999`).toISOString();

const formatMoney = (n: number) =>
    n.toLocaleString('ru-RU', {
        maximumFractionDigits: 0,
    });

const formatSigned = (n: number) => {
    const abs = formatMoney(Math.abs(n));
    if (n > 0) return `+${abs}`;
    if (n < 0) return `−${abs}`;
    return abs;
};

const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

const formatCount = (n: number) =>
    Math.round(n).toLocaleString('ru-RU');

const pluralMovements = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'движение';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return 'движения';
    }
    return 'движений';
};

type HoverPoint = { x: number; y: number };

/** Позиционирует тултип: справа от точки, у правого края — слева */
const ChartHoverTooltipShell = ({
    tip,
    visible,
    children,
}: {
    tip: HoverPoint;
    visible: boolean;
    children: ReactNode;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({
        left: tip.x + 14,
        top: Math.max(8, tip.y - 20),
    });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const parent = el.offsetParent as HTMLElement | null;
        const pad = 8;
        const gap = 14;
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        const cw = parent?.clientWidth ?? window.innerWidth;
        const ch = parent?.clientHeight ?? window.innerHeight;

        let left = tip.x + gap;
        if (left + tw > cw - pad) {
            left = tip.x - tw - gap;
        }
        left = Math.max(pad, Math.min(left, cw - tw - pad));

        let top = tip.y - 20;
        if (top + th > ch - pad) {
            top = ch - th - pad;
        }
        top = Math.max(pad, top);

        setCoords({ left, top });
    }, [tip.x, tip.y, visible]);

    return (
        <div
            ref={ref}
            className={`${cls.volumeTooltip} ${visible ? cls.volumeTooltipVisible : ''}`}
            style={{
                position: 'absolute',
                left: coords.left,
                top: coords.top,
                pointerEvents: 'none',
            }}
        >
            {children}
        </div>
    );
};

type VolumeHoverTip = {
    printerId: string;
    label: string;
    x: number;
    y: number;
    color: string;
};

const VolumeHoverTooltip = ({
    tip,
    rows,
    visible,
}: {
    tip: VolumeHoverTip;
    rows: PrintVolumeMonthRow[];
    visible: boolean;
}) => {
    const row = rows.find((r) => r.label === tip.label);
    const p = row?.printers.find((x) => x.printerId === tip.printerId);
    if (!p) return null;

    const v = p.volume;
    const specialEntries = Object.entries(v.special || {}).filter(
        ([, n]) => n > 0
    );

    return (
        <ChartHoverTooltipShell tip={tip} visible={visible}>
            <div className={cls.volumeTooltipTitle}>{tip.label}</div>
            <div
                className={cls.volumeTooltipName}
                style={{ color: tip.color }}
            >
                {p.name}
            </div>
            <div className={cls.volumeTooltipLine}>
                Общий: <b>{formatCount(v.total)}</b>
            </div>
            {v.mono != null && (
                <div className={cls.volumeTooltipLine}>
                    Ч/Б: <b>{formatCount(v.mono)}</b>
                </div>
            )}
            {v.color != null && (
                <div className={cls.volumeTooltipLine}>
                    Цвет: <b>{formatCount(v.color)}</b>
                </div>
            )}
            {specialEntries.map(([code, n]) => (
                <div key={code} className={cls.volumeTooltipLine}>
                    {specialColorLabel(code)}: <b>{formatCount(n)}</b>
                </div>
            ))}
        </ChartHoverTooltipShell>
    );
};

type CostHoverTip = {
    printerName: string;
    label: string;
    x: number;
    y: number;
    color: string;
};

const COST_MODE_LABELS: Record<CostMode, string> = {
    purchase: 'Закуплено',
    used: 'Потрачено',
};

const MATERIAL_LABELS: Record<MaterialKind, string> = {
    paper: 'Бумага',
    lamination: 'Ламинация',
};

const CostHoverTooltip = ({
    tip,
    rows,
    visible,
    mode,
}: {
    tip: CostHoverTip;
    rows: PrinterCostMonthRow[];
    visible: boolean;
    mode: CostMode;
}) => {
    const row = rows.find((r) => r.label === tip.label);
    const p = row?.printers.find((x) => x.name === tip.printerName);
    if (!p) return null;

    return (
        <ChartHoverTooltipShell tip={tip} visible={visible}>
            <div className={cls.volumeTooltipTitle}>{tip.label}</div>
            <div
                className={cls.volumeTooltipName}
                style={{ color: tip.color }}
            >
                {p.name}
            </div>
            <div className={cls.volumeTooltipLine}>
                {COST_MODE_LABELS[mode]}: <b>{formatMoney(p.total)} ₽</b>
            </div>
            {COST_CATEGORIES.map((key) => {
                const n = p.breakdown[key] || 0;
                if (!(n > 0)) return null;
                return (
                    <div key={key} className={cls.volumeTooltipLine}>
                        <span
                            className={cls.costCatDot}
                            style={{ background: COST_CATEGORY_COLORS[key] }}
                        />
                        {COST_CATEGORY_LABELS[key]}:{' '}
                        <b>{formatMoney(n)} ₽</b>
                    </div>
                );
            })}
        </ChartHoverTooltipShell>
    );
};

/** Чипы тонеров по цветам: кружок цвета + количество, шт. */
const TonerChips = ({
    units,
    size = 'sm',
}: {
    units: Record<string, number> | undefined;
    size?: 'sm' | 'md';
}) => {
    if (!units) return <span className={cls.dim}>—</span>;
    const colors = sortedTonerColors(units);
    if (colors.length === 0) return <span className={cls.dim}>—</span>;
    return (
        <span
            className={`${cls.tonerChips} ${size === 'md' ? cls.tonerChipsMd : ''}`}
        >
            {colors.map((c) => (
                <span
                    key={c}
                    className={cls.tonerChip}
                    title={`${c}: ${units[c]} шт.`}
                >
                    <i style={{ background: getTonerSwatchColor(c) }} />
                    {units[c]}
                </span>
            ))}
        </span>
    );
};

const formatClick = (n: number) =>
    n.toLocaleString('ru-RU', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    });

/** Вертикальный список категорий: точка · название · полоска · сумма */
const CategoryList = ({
    breakdown,
    total,
}: {
    breakdown: Record<CostCategory, number>;
    total: number;
}) => {
    const items = COST_CATEGORIES.map((key) => ({
        key,
        value: breakdown[key] || 0,
    }))
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value);

    if (items.length === 0) {
        return <div className={cls.catEmpty}>Нет данных за период</div>;
    }
    return (
        <ul className={cls.catList}>
            {items.map(({ key, value }) => (
                <li key={key} className={cls.catRow}>
                    <span className={cls.catLabel}>
                        <i style={{ background: COST_CATEGORY_COLORS[key] }} />
                        {COST_CATEGORY_LABELS[key]}
                    </span>
                    <span className={cls.catTrack}>
                        <span
                            className={cls.catFill}
                            style={{
                                width: `${Math.max(2, (value / total) * 100)}%`,
                                background: COST_CATEGORY_COLORS[key],
                            }}
                        />
                    </span>
                    <span className={cls.catValue}>
                        {formatMoney(value)} ₽
                    </span>
                </li>
            ))}
        </ul>
    );
};

/** Плитка показателя в карточке принтера */
const StatTile = ({
    label,
    children,
    hint,
    active,
    tone,
}: {
    label: string;
    children: ReactNode;
    hint?: string;
    active?: boolean;
    tone?: 'positive' | 'negative';
}) => (
    <div
        className={`${cls.tile} ${active ? cls.tileActive : ''}`}
        title={hint}
    >
        <div className={cls.tileLabel}>{label}</div>
        <div
            className={`${cls.tileValue} ${
                tone === 'positive'
                    ? cls.positive
                    : tone === 'negative'
                      ? cls.negative
                      : ''
            }`}
        >
            {children}
        </div>
    </div>
);

const AnalyticsPage = () => {
    const dispatch = useAppDispatch();
    dispatch(changePage('analytics'));
    const { printers } = usePrinters();
    const { usedPartsArray } = useUsedParts();
    const { tonersArray: tonerHistory } = useTonerHistory();
    const { from, to, refreshNonce, exportNonce } = useAppSelector(
        (state) => state.analyticsFilter
    );

    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [costMovements, setCostMovements] = useState<StockMovement[]>([]);
    const [counterReadings, setCounterReadings] = useState<
        CounterReadingRecord[]
    >([]);
    const [stockValue, setStockValue] = useState(0);
    const [lots, setLots] = useState<StockLot[]>([]);
    const [showUnattached, setShowUnattached] = useState(false);
    const paperStockEnabled = useAppSelector(
        (s) => s.appSettings.paperStockEnabled
    );
    const laminationStockEnabled = useAppSelector(
        (s) => s.appSettings.laminationStockEnabled
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [volumeHoverTip, setVolumeHoverTip] =
        useState<VolumeHoverTip | null>(null);
    const [volumeTipVisible, setVolumeTipVisible] = useState(false);
    const [volumeTipShown, setVolumeTipShown] =
        useState<VolumeHoverTip | null>(null);
    /** id принтеров, скрытых на графике объёма */
    const [hiddenVolumePrinters, setHiddenVolumePrinters] = useState<
        Record<string, boolean>
    >({});
    const [costMode, setCostMode] = useState<CostMode>('purchase');
    const [hiddenCostPrinters, setHiddenCostPrinters] = useState<
        Record<string, boolean>
    >({});
    const [costHoverTip, setCostHoverTip] = useState<CostHoverTip | null>(null);
    const [costTipVisible, setCostTipVisible] = useState(false);
    const [costTipShown, setCostTipShown] = useState<CostHoverTip | null>(null);
    /** Выбранный принтер в блоке «Затраты по принтерам» */
    const [selectedPrinter, setSelectedPrinter] = useState<string | null>(
        null
    );
    /** Принтер, оставленный один на графиках (фокус) */
    const [focusedPrinter, setFocusedPrinter] = useState<string | null>(null);
    const [movementsPrinterFilter, setMovementsPrinterFilter] = useState('');
    const [movementsKindFilter, setMovementsKindFilter] = useState('');
    const movementsRef = useRef<HTMLDivElement>(null);
    const lastExportNonce = useRef(0);

    useEffect(() => {
        if (volumeHoverTip) {
            setVolumeTipShown(volumeHoverTip);
            const id = window.requestAnimationFrame(() =>
                setVolumeTipVisible(true)
            );
            return () => window.cancelAnimationFrame(id);
        }
        setVolumeTipVisible(false);
        const t = window.setTimeout(() => setVolumeTipShown(null), 220);
        return () => window.clearTimeout(t);
    }, [volumeHoverTip]);

    useEffect(() => {
        if (costHoverTip) {
            setCostTipShown(costHoverTip);
            const id = window.requestAnimationFrame(() =>
                setCostTipVisible(true)
            );
            return () => window.cancelAnimationFrame(id);
        }
        setCostTipVisible(false);
        const t = window.setTimeout(() => setCostTipShown(null), 220);
        return () => window.clearTimeout(t);
    }, [costHoverTip]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [moves, costMoves, lots, readings] = await Promise.all([
                fetchMovementsInRange(startOfDayIso(from), endOfDayIso(to)),
                fetchRecentMovements(800),
                fetchOpenLots(),
                fetchAllCounterReadings(),
            ]);
            setMovements(moves);
            setCostMovements(costMoves.length > 0 ? costMoves : moves);
            setStockValue(stockValueFromLots(lots));
            setLots(lots);
            setCounterReadings(readings);
        } catch (err: any) {
            console.error(err);
            setError(
                err?.message ||
                    'Не удалось загрузить аналитику. Проверьте индекс Firestore по полю date.'
            );
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (refreshNonce > 0) {
            load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- только кнопка «Обновить»
    }, [refreshNonce]);

    const writeoffs = useMemo(
        () =>
            movements.filter(
                (m) => m.kind === 'writeoff' && isActiveCostMovement(m)
            ),
        [movements]
    );
    const purchases = useMemo(
        () =>
            movements.filter(
                (m) => m.kind === 'purchase' && isActiveCostMovement(m)
            ),
        [movements]
    );
    const engineerMoves = useMemo(
        () =>
            movements.filter(
                (m) => m.kind === 'engineer' && isActiveCostMovement(m)
            ),
        [movements]
    );

    // Потрачено = списания (замены, расходка, тонер) + работа инженера
    const usedCost =
        writeoffs.reduce((s, m) => s + Number(m.totalCost || 0), 0) +
        engineerMoves.reduce((s, m) => s + Number(m.totalCost || 0), 0);
    // Закуплено = только приходы
    const purchaseCost = purchases.reduce(
        (s, m) => s + Number(m.totalCost || 0),
        0
    );

    const economyTotal = writeoffs.reduce(
        (s, m) => s + (Number(m.economyAmount) || 0),
        0
    );

    // Объём печати — не режем фильтром затрат; максимум 12 месяцев
    const allVolumeRows = useMemo(
        () => buildPrintVolumeSeries(counterReadings),
        [counterReadings]
    );
    const printVolumeRows = useMemo(
        () => allVolumeRows.slice(-12),
        [allVolumeRows]
    );

    const printVolumePrinters = useMemo(() => {
        const map = new Map<string, string>();
        printVolumeRows.forEach((row) => {
            row.printers.forEach((p) => map.set(p.printerId, p.name));
        });
        return Array.from(map.entries()).map(([id, name], i) => ({
            id,
            name,
            color: PRINTER_LINE_COLORS[i % PRINTER_LINE_COLORS.length],
        }));
    }, [printVolumeRows]);

    const toggleVolumePrinter = (id: string) => {
        setHiddenVolumePrinters((prev) => {
            const next = { ...prev, [id]: !prev[id] };
            return next;
        });
        setVolumeHoverTip((tip) => (tip?.printerId === id ? null : tip));
    };

    const costSourceMovements = useMemo(() => {
        const byId = new Map<string, StockMovement>();
        [...costMovements, ...movements].forEach((m) => {
            if (m.id) byId.set(m.id, m);
        });
        return Array.from(byId.values());
    }, [costMovements, movements]);

    const usageExtraMovements = useMemo(
        () =>
            usageEventsToMovements(
                usedPartsArray,
                tonerHistory,
                costSourceMovements
            ),
        [usedPartsArray, tonerHistory, costSourceMovements]
    );

    const costMonthRows = useMemo(
        () =>
            buildPrinterMonthlyCosts(
                printers.map((p) => ({ name: p.name, model: p.model })),
                costSourceMovements,
                costMode,
                costMode === 'used' ? usageExtraMovements : []
            ),
        [printers, costSourceMovements, costMode, usageExtraMovements]
    );

    const costChartHasData = useMemo(
        () => costSeriesHasData(costMonthRows),
        [costMonthRows]
    );

    const costChartPrinters = useMemo(() => {
        const names = new Set<string>();
        printers.forEach((p) => {
            if (p.name) names.add(p.name);
        });
        costMonthRows.forEach((row) => {
            row.printers.forEach((p) => {
                if (p.total > 0) names.add(p.name);
            });
        });
        return Array.from(names)
            .sort((a, b) => a.localeCompare(b, 'ru'))
            .map((name, i) => ({
                id: name,
                name,
                color: PRINTER_LINE_COLORS[i % PRINTER_LINE_COLORS.length],
            }));
    }, [printers, costMonthRows]);

    const toggleCostPrinter = (id: string) => {
        setHiddenCostPrinters((prev) => ({ ...prev, [id]: !prev[id] }));
        setCostHoverTip((tip) => (tip?.printerName === id ? null : tip));
        setFocusedPrinter(null);
    };

    /** Оставить на обоих графиках только один принтер (или вернуть все) */
    const focusPrinterOnCharts = (name: string) => {
        if (focusedPrinter === name) {
            setFocusedPrinter(null);
            setHiddenCostPrinters({});
            setHiddenVolumePrinters({});
            return;
        }
        setFocusedPrinter(name);
        const hiddenCost: Record<string, boolean> = {};
        costChartPrinters.forEach((p) => {
            if (p.name !== name) hiddenCost[p.id] = true;
        });
        setHiddenCostPrinters(hiddenCost);
        const hiddenVolume: Record<string, boolean> = {};
        printVolumePrinters.forEach((p) => {
            if (p.name !== name) hiddenVolume[p.id] = true;
        });
        setHiddenVolumePrinters(hiddenVolume);
        setCostHoverTip(null);
        setVolumeHoverTip(null);
    };

    const printerRows = useMemo(
        () =>
            buildPrinterAnalytics(
                printers.map((p) => ({ name: p.name, model: p.model })),
                movements
            ),
        [printers, movements]
    );

    const tonerUnitsByPrinter = useMemo(
        () =>
            buildTonerUnits(
                movements,
                tonerHistory,
                startOfDayIso(from),
                endOfDayIso(to)
            ),
        [movements, tonerHistory, from, to]
    );

    const unattachedMovements = useMemo(
        () =>
            collectUnattachedMovements(
                printers.map((p) => ({ name: p.name, model: p.model })),
                movements
            ),
        [printers, movements]
    );
    const unattachedTotal = useMemo(
        () =>
            unattachedMovements.reduce(
                (s, m) => s + (Number(m.totalCost) || 0),
                0
            ),
        [unattachedMovements]
    );

    const materials = useMemo(
        () => buildMaterialsSummary(movements, costSourceMovements, lots),
        [movements, costSourceMovements, lots]
    );
    const materialKinds = useMemo(
        () =>
            (['paper', 'lamination'] as MaterialKind[]).filter((k) => {
                const t = materials.byKind[k];
                const enabled =
                    k === 'paper' ? paperStockEnabled : laminationStockEnabled;
                return (
                    enabled ||
                    t.purchasedQty > 0 ||
                    t.usedQty > 0 ||
                    t.stockQty > 0
                );
            }),
        [materials, paperStockEnabled, laminationStockEnabled]
    );

    const selectedRow = useMemo(
        () =>
            printerRows.find((r) => r.name === selectedPrinter) ||
            printerRows[0] ||
            null,
        [printerRows, selectedPrinter]
    );

    const clickCosts = useMemo(
        () => buildClickCosts(printerRows, allVolumeRows, from, to),
        [printerRows, allVolumeRows, from, to]
    );

    const costPurchaseMonthRows = useMemo(
        () =>
            buildPrinterMonthlyCosts(
                printers.map((p) => ({ name: p.name, model: p.model })),
                costSourceMovements,
                'purchase'
            ),
        [printers, costSourceMovements]
    );

    const costUsedMonthRows = useMemo(
        () =>
            buildPrinterMonthlyCosts(
                printers.map((p) => ({ name: p.name, model: p.model })),
                costSourceMovements,
                'used',
                usageExtraMovements
            ),
        [printers, costSourceMovements, usageExtraMovements]
    );

    useEffect(() => {
        if (exportNonce === 0 || exportNonce === lastExportNonce.current) {
            return;
        }
        lastExportNonce.current = exportNonce;
        void exportAnalyticsExcel({
            from,
            to,
            stockValue,
            printerRows,
            clickCosts,
            volumeRows: allVolumeRows.slice(-12),
            costPurchaseRows: costPurchaseMonthRows,
            costUsedRows: costUsedMonthRows,
            movements,
            counterReadings,
            usedParts: usedPartsArray,
            tonerHistory,
        }).catch((err) => {
            console.error(err);
            setError(
                err?.message ||
                    'Не удалось выгрузить Excel. Попробуйте ещё раз.'
            );
        });
    }, [
        exportNonce,
        from,
        to,
        stockValue,
        printerRows,
        clickCosts,
        allVolumeRows,
        costPurchaseMonthRows,
        costUsedMonthRows,
        movements,
        counterReadings,
        usedPartsArray,
        tonerHistory,
    ]);

    const movementMachines = useMemo(() => {
        const set = new Set<string>();
        printers.forEach((p) => {
            if (p.name) set.add(p.name);
        });
        movements.forEach((m) => {
            const name = (m.machine || '').trim();
            if (name) set.add(name);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [printers, movements]);

    const recentAll = useMemo(() => {
        const list = [...movements].reverse();
        return list.filter((m) => {
            if (
                movementsPrinterFilter &&
                (m.machine || '').trim() !== movementsPrinterFilter
            ) {
                return false;
            }
            if (movementsKindFilter) {
                if (movementsKindFilter === 'writeoff') {
                    return m.kind === 'writeoff' || m.kind === 'storno';
                }
                return m.kind === movementsKindFilter;
            }
            return true;
        });
    }, [movements, movementsPrinterFilter, movementsKindFilter]);

    const showMovementsFor = (name: string) => {
        setMovementsPrinterFilter(name);
        setMovementsKindFilter('');
        window.requestAnimationFrame(() => {
            movementsRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    };
    const {
        visibleItems: recent,
        sentinelRef: recentSentinelRef,
        hasMore: recentHasMore,
        total: recentTotal,
        visibleCount: recentVisibleCount,
    } = useInfiniteList(recentAll);

    const kindLabel = (kind: string, reversed?: boolean) => {
        if (kind === 'storno') return 'Сторно';
        if (kind === 'purchase') return 'Приход';
        if (kind === 'writeoff') {
            return reversed ? 'Списание (отменено)' : 'Списание';
        }
        if (kind === 'engineer') {
            return reversed ? 'Инженер (отменено)' : 'Инженер';
        }
        return kind;
    };

    return (
        <div className={cls.page}>
            <div className={cls.header}>
                <h1 className={cls.title}>Аналитика затрат</h1>
                {loading && (
                    <span className={cls.loadingHint}>Обновление…</span>
                )}
            </div>

            {error && <div className={cls.error}>{error}</div>}

            <div className={cls.kpis}>
                <div className={cls.kpi}>
                    <div className={cls.kpiLabel}>Остаток на складе</div>
                    <div className={`${cls.kpiValue} ${cls.kpiAccent}`}>
                        {formatMoney(stockValue)} ₽
                    </div>
                </div>
                <div className={cls.kpi}>
                    <div className={cls.kpiLabel}>Закуплено за период</div>
                    <div className={cls.kpiValue}>
                        {formatMoney(purchaseCost)} ₽
                    </div>
                </div>
                <div className={cls.kpi}>
                    <div className={cls.kpiLabel}>Потрачено за период</div>
                    <div className={cls.kpiValue}>
                        {formatMoney(usedCost)} ₽
                    </div>
                    <div className={cls.kpiSub}>
                        замены, расходка, тонер, инженер
                    </div>
                </div>
                <div className={cls.kpi}>
                    <div className={cls.kpiLabel}>Экономия / перерасход</div>
                    <div
                        className={`${cls.kpiValue} ${
                            economyTotal > 0
                                ? cls.positive
                                : economyTotal < 0
                                  ? cls.negative
                                  : ''
                        }`}
                    >
                        {formatSigned(economyTotal)} ₽
                    </div>
                </div>
            </div>

            {loading && movements.length === 0 ? (
                <div className={cls.loading}>Загрузка…</div>
            ) : (
                <>
                    <div className={cls.charts}>
                        <div className={`${cls.chartCard} ${cls.chartWide}`}>
                            <h3 className={cls.chartTitle}>
                                Объём печати (по месяцам)
                            </h3>
                            {printVolumeRows.length === 0 ? (
                                <div className={cls.empty}>
                                    Нужно минимум два снятия счётчиков, чтобы
                                    показать динамику
                                </div>
                            ) : (
                                <div className={cls.volumeChartWrap}>
                                    <div
                                        className={cls.volumeToggles}
                                        role="group"
                                        aria-label="Принтеры на графике"
                                    >
                                        {printVolumePrinters.map((p) => {
                                            const on = !hiddenVolumePrinters[p.id];
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={`${cls.volumeToggle} ${on ? cls.volumeToggleOn : cls.volumeToggleOff}`}
                                                    style={
                                                        {
                                                            '--toggle-color':
                                                                p.color,
                                                        } as CSSProperties
                                                    }
                                                    aria-pressed={on}
                                                    onClick={() =>
                                                        toggleVolumePrinter(
                                                            p.id
                                                        )
                                                    }
                                                >
                                                    <i
                                                        className={
                                                            cls.volumeToggleDot
                                                        }
                                                    />
                                                    {p.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={280}
                                    >
                                        <LineChart data={printVolumeRows}>
                                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                            <XAxis
                                                dataKey="label"
                                                stroke="rgba(255,255,255,0.45)"
                                                fontSize={11}
                                            />
                                            <YAxis
                                                stroke="rgba(255,255,255,0.45)"
                                                fontSize={11}
                                                tickFormatter={(v) =>
                                                    Number(v) >= 1000
                                                        ? `${Math.round(Number(v) / 1000)}k`
                                                        : String(v)
                                                }
                                            />
                                            {printVolumePrinters.map((p) => {
                                                if (hiddenVolumePrinters[p.id]) {
                                                    return null;
                                                }
                                                const stroke = p.color;
                                                return (
                                                    <Line
                                                        key={p.id}
                                                        type="monotone"
                                                        dataKey={p.id}
                                                        name={p.name}
                                                        stroke={stroke}
                                                        strokeWidth={2}
                                                        connectNulls
                                                        isAnimationActive={
                                                            false
                                                        }
                                                        activeDot={false}
                                                        dot={(dotProps: {
                                                            cx?: number;
                                                            cy?: number;
                                                            payload?: {
                                                                label?: string;
                                                            };
                                                        }) => {
                                                            const {
                                                                cx,
                                                                cy,
                                                                payload,
                                                            } = dotProps;
                                                            if (
                                                                cx == null ||
                                                                cy == null ||
                                                                !payload?.label
                                                            ) {
                                                                return <g />;
                                                            }
                                                            return (
                                                                <circle
                                                                    cx={cx}
                                                                    cy={cy}
                                                                    r={7}
                                                                    fill={
                                                                        stroke
                                                                    }
                                                                    stroke="#1E1E1E"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                    }}
                                                                    onMouseEnter={() =>
                                                                        setVolumeHoverTip(
                                                                            {
                                                                                printerId:
                                                                                    p.id,
                                                                                label: payload.label!,
                                                                                x: cx,
                                                                                y: cy,
                                                                                color: stroke,
                                                                            }
                                                                        )
                                                                    }
                                                                    onMouseLeave={() =>
                                                                        setVolumeHoverTip(
                                                                            null
                                                                        )
                                                                    }
                                                                />
                                                            );
                                                        }}
                                                    />
                                                );
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                    {volumeTipShown && (
                                        <VolumeHoverTooltip
                                            tip={volumeTipShown}
                                            rows={printVolumeRows}
                                            visible={volumeTipVisible}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        <div className={`${cls.chartCard} ${cls.chartWide}`}>
                            <div className={cls.costChartHead}>
                                <h3 className={cls.chartTitle}>
                                    Затраты (по месяцам)
                                </h3>
                                <div
                                    className={cls.costModeSwitch}
                                    role="group"
                                    aria-label="Тип затрат"
                                >
                                    {(['purchase', 'used'] as CostMode[]).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            className={
                                                costMode === m
                                                    ? cls.costModeActive
                                                    : cls.costModeBtn
                                            }
                                            onClick={() => setCostMode(m)}
                                        >
                                            {COST_MODE_LABELS[m]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {!costChartHasData ? (
                                <div className={cls.empty}>
                                    Нет движений склада с суммой за выбранный
                                    режим. Переключите «Закуплено» /
                                    «Потрачено» или проверьте, что закупки и
                                    списания пишутся в StockMovements.
                                </div>
                            ) : (
                                <div className={cls.volumeChartWrap}>
                                    <div
                                        className={cls.volumeToggles}
                                        role="group"
                                        aria-label="Принтеры на графике затрат"
                                    >
                                        {costChartPrinters.map((p) => {
                                            const on =
                                                !hiddenCostPrinters[p.id];
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={`${cls.volumeToggle} ${on ? cls.volumeToggleOn : cls.volumeToggleOff}`}
                                                    style={
                                                        {
                                                            '--toggle-color':
                                                                p.color,
                                                        } as CSSProperties
                                                    }
                                                    aria-pressed={on}
                                                    onClick={() =>
                                                        toggleCostPrinter(p.id)
                                                    }
                                                >
                                                    <i
                                                        className={
                                                            cls.volumeToggleDot
                                                        }
                                                    />
                                                    {p.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={280}
                                    >
                                        <LineChart data={costMonthRows}>
                                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                                            <XAxis
                                                dataKey="label"
                                                stroke="rgba(255,255,255,0.45)"
                                                fontSize={11}
                                            />
                                            <YAxis
                                                stroke="rgba(255,255,255,0.45)"
                                                fontSize={11}
                                                width={56}
                                                tickFormatter={(v) => {
                                                    const n = Number(v);
                                                    return n >= 1000
                                                        ? `${Math.round(n / 1000)}k ₽`
                                                        : `${n} ₽`;
                                                }}
                                            />
                                            {costChartPrinters.map((p) => {
                                                if (hiddenCostPrinters[p.id]) {
                                                    return null;
                                                }
                                                const stroke = p.color;
                                                return (
                                                    <Line
                                                        key={p.id}
                                                        type="monotone"
                                                        dataKey={p.id}
                                                        name={p.name}
                                                        stroke={stroke}
                                                        strokeWidth={2}
                                                        connectNulls
                                                        isAnimationActive={
                                                            false
                                                        }
                                                        activeDot={false}
                                                        dot={(dotProps: {
                                                            cx?: number;
                                                            cy?: number;
                                                            payload?: {
                                                                label?: string;
                                                            };
                                                        }) => {
                                                            const {
                                                                cx,
                                                                cy,
                                                                payload,
                                                            } = dotProps;
                                                            if (
                                                                cx == null ||
                                                                cy == null ||
                                                                !payload?.label
                                                            ) {
                                                                return <g />;
                                                            }
                                                            return (
                                                                <circle
                                                                    cx={cx}
                                                                    cy={cy}
                                                                    r={7}
                                                                    fill={
                                                                        stroke
                                                                    }
                                                                    stroke="#1E1E1E"
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                    }}
                                                                    onMouseEnter={() =>
                                                                        setCostHoverTip(
                                                                            {
                                                                                printerName:
                                                                                    p.id,
                                                                                label: payload.label!,
                                                                                x: cx,
                                                                                y: cy,
                                                                                color: stroke,
                                                                            }
                                                                        )
                                                                    }
                                                                    onMouseLeave={() =>
                                                                        setCostHoverTip(
                                                                            null
                                                                        )
                                                                    }
                                                                />
                                                            );
                                                        }}
                                                    />
                                                );
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                    {costTipShown && (
                                        <CostHoverTooltip
                                            tip={costTipShown}
                                            rows={costMonthRows}
                                            visible={costTipVisible}
                                            mode={costMode}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <section className={cls.section}>
                        <div className={cls.sectionHead}>
                            <h2 className={cls.sectionTitle}>
                                Затраты по принтерам
                            </h2>
                            <p className={cls.sectionHint}>
                                Сводка за выбранный период. Закуплено —
                                приходы склада (без привязки к аппарату
                                делятся поровну между принтерами той же
                                модели). Потрачено — замены, расходка, тонер
                                и работа инженера по аппарату. Выберите
                                принтер слева.
                            </p>
                        </div>

                        {printerRows.length === 0 ? (
                            <div className={cls.empty}>Нет данных</div>
                        ) : (
                            <div className={cls.printerPanel}>
                                <aside
                                    className={cls.printerList}
                                    role="tablist"
                                    aria-label="Принтеры"
                                >
                                    {printerRows.map((row) => {
                                        const active =
                                            selectedRow?.name === row.name;
                                        const units = tonerUnitsByPrinter.get(
                                            row.name
                                        );
                                        return (
                                            <button
                                                key={row.name}
                                                type="button"
                                                role="tab"
                                                aria-selected={active}
                                                className={`${cls.printerListItem} ${
                                                    active
                                                        ? cls.printerListItemActive
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    setSelectedPrinter(
                                                        row.name
                                                    )
                                                }
                                            >
                                                <span
                                                    className={
                                                        cls.printerListName
                                                    }
                                                >
                                                    <strong>
                                                        {row.name}
                                                    </strong>
                                                    {row.model &&
                                                        row.model !==
                                                            row.name && (
                                                            <small>
                                                                {row.model}
                                                            </small>
                                                        )}
                                                </span>
                                                <span
                                                    className={
                                                        cls.printerListMeta
                                                    }
                                                >
                                                    <b>
                                                        {row.usedTotal > 0
                                                            ? `${formatMoney(row.usedTotal)} ₽`
                                                            : '—'}
                                                    </b>
                                                    <small>
                                                        {totalTonerUnits(
                                                            units
                                                        ) > 0
                                                            ? `${totalTonerUnits(units)} тон.`
                                                            : 'потрачено'}
                                                    </small>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </aside>

                                {selectedRow && (
                                    <div
                                        className={cls.printerDetail}
                                        key={selectedRow.name}
                                    >
                                        <header className={cls.detailHead}>
                                            <div>
                                                <h3 className={cls.detailName}>
                                                    {selectedRow.name}
                                                </h3>
                                                {selectedRow.model &&
                                                    selectedRow.model !==
                                                        selectedRow.name && (
                                                        <span
                                                            className={
                                                                cls.detailModel
                                                            }
                                                        >
                                                            {selectedRow.model}
                                                        </span>
                                                    )}
                                            </div>
                                            <div className={cls.detailsActions}>
                                                <button
                                                    type="button"
                                                    className={`${cls.ghostBtn} ${
                                                        focusedPrinter ===
                                                        selectedRow.name
                                                            ? cls.ghostBtnActive
                                                            : ''
                                                    }`}
                                                    onClick={() =>
                                                        focusPrinterOnCharts(
                                                            selectedRow.name
                                                        )
                                                    }
                                                >
                                                    {focusedPrinter ===
                                                    selectedRow.name
                                                        ? 'Все на графиках'
                                                        : 'Только этот на графиках'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={cls.ghostBtn}
                                                    onClick={() =>
                                                        showMovementsFor(
                                                            selectedRow.name
                                                        )
                                                    }
                                                >
                                                    Движения
                                                </button>
                                            </div>
                                        </header>

                                        {(() => {
                                            const cc = clickCosts.find(
                                                (c) =>
                                                    c.name === selectedRow.name
                                            );
                                            const units =
                                                tonerUnitsByPrinter.get(
                                                    selectedRow.name
                                                );
                                            return (
                                                <div className={cls.tiles}>
                                                    <StatTile
                                                        label="Закуплено"
                                                        active={
                                                            costMode ===
                                                            'purchase'
                                                        }
                                                    >
                                                        {selectedRow.purchasedTotal >
                                                        0
                                                            ? `${formatMoney(selectedRow.purchasedTotal)} ₽`
                                                            : '—'}
                                                    </StatTile>
                                                    <StatTile
                                                        label="Потрачено"
                                                        active={
                                                            costMode === 'used'
                                                        }
                                                    >
                                                        {selectedRow.usedTotal >
                                                        0
                                                            ? `${formatMoney(selectedRow.usedTotal)} ₽`
                                                            : '—'}
                                                    </StatTile>
                                                    <StatTile
                                                        label="₽ / клик"
                                                        hint="Потрачено ₽ ÷ оттиски за период"
                                                    >
                                                        {cc?.clickCost != null
                                                            ? formatClick(
                                                                  cc.clickCost
                                                              )
                                                            : '—'}
                                                    </StatTile>
                                                    <StatTile label="Оттиски">
                                                        {cc && cc.pages > 0
                                                            ? cc.pages.toLocaleString(
                                                                  'ru-RU'
                                                              )
                                                            : '—'}
                                                    </StatTile>
                                                    <StatTile
                                                        label="Тонеры, шт."
                                                        hint="Списано тонеров по цветам за период"
                                                    >
                                                        <TonerChips
                                                            units={units}
                                                            size="md"
                                                        />
                                                    </StatTile>
                                                    <StatTile label="Замен запчастей">
                                                        {selectedRow.replacements >
                                                        0
                                                            ? selectedRow.replacements
                                                            : '—'}
                                                    </StatTile>
                                                    <StatTile
                                                        label="Экономия / перерасход"
                                                        hint="По расходке: факт. ресурс vs заводской, в рублях FIFO-стоимости"
                                                        tone={
                                                            selectedRow.economy >
                                                            0
                                                                ? 'positive'
                                                                : selectedRow.economy <
                                                                    0
                                                                  ? 'negative'
                                                                  : undefined
                                                        }
                                                    >
                                                        {selectedRow.economy !==
                                                        0
                                                            ? `${formatSigned(selectedRow.economy)} ₽`
                                                            : '—'}
                                                    </StatTile>
                                                </div>
                                            );
                                        })()}

                                        <div className={cls.breakdownCols}>
                                            <div className={cls.breakdownBlock}>
                                                <h4 className={cls.breakdownTitle}>
                                                    Закуплено по категориям
                                                </h4>
                                                <CategoryList
                                                    breakdown={
                                                        selectedRow.purchased
                                                    }
                                                    total={
                                                        selectedRow.purchasedTotal
                                                    }
                                                />
                                            </div>
                                            <div className={cls.breakdownBlock}>
                                                <h4 className={cls.breakdownTitle}>
                                                    Потрачено по категориям
                                                </h4>
                                                <CategoryList
                                                    breakdown={selectedRow.used}
                                                    total={selectedRow.usedTotal}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {unattachedMovements.length > 0 && (
                            <div className={cls.unattached}>
                                <div className={cls.unattachedHead}>
                                    <span className={cls.unattachedIcon}>
                                        !
                                    </span>
                                    <span className={cls.unattachedText}>
                                        {unattachedMovements.length}{' '}
                                        {pluralMovements(
                                            unattachedMovements.length
                                        )}{' '}
                                        на {formatMoney(unattachedTotal)} ₽
                                        без привязки к аппарату — в сводку по
                                        принтерам не входят.
                                    </span>
                                    <button
                                        type="button"
                                        className={cls.ghostBtn}
                                        onClick={() =>
                                            setShowUnattached((v) => !v)
                                        }
                                    >
                                        {showUnattached
                                            ? 'Скрыть'
                                            : 'Показать'}
                                    </button>
                                </div>
                                {showUnattached && (
                                    <ul className={cls.unattachedList}>
                                        {unattachedMovements.map((m) => (
                                            <li key={m.id}>
                                                <span className={cls.dim}>
                                                    {formatDateShort(m.date)}
                                                </span>
                                                <span>
                                                    {kindLabel(m.kind)}
                                                </span>
                                                <span
                                                    className={
                                                        cls.unattachedName
                                                    }
                                                >
                                                    {m.type === 'toner'
                                                        ? `Тонер ${m.color || ''}${
                                                              m.model
                                                                  ? ` · ${m.model}`
                                                                  : ''
                                                          }`
                                                        : `${m.partN || ''} ${
                                                              m.partName || ''
                                                          }`.trim() ||
                                                          'Вызов инженера'}
                                                </span>
                                                <b>
                                                    {formatMoney(
                                                        Number(m.totalCost)
                                                    )}{' '}
                                                    ₽
                                                </b>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>

                    {materialKinds.length > 0 && (
                        <section className={cls.section}>
                            <div className={cls.sectionHead}>
                                <h2 className={cls.sectionTitle}>
                                    Материалы
                                </h2>
                                <p className={cls.sectionHint}>
                                    Бумага и ламинация учитываются отдельно
                                    от принтеров: закуплено и потрачено за
                                    период, остаток — по открытым партиям.
                                </p>
                            </div>
                            <div className={cls.materialsCard}>
                                <div className={cls.materialsGrid}>
                                    {materialKinds.map((k) => {
                                        const t = materials.byKind[k];
                                        return (
                                            <div
                                                key={k}
                                                className={cls.materialBlock}
                                            >
                                                <div
                                                    className={
                                                        cls.materialTitle
                                                    }
                                                >
                                                    {MATERIAL_LABELS[k]}
                                                </div>
                                                <dl className={cls.materialDl}>
                                                    <div>
                                                        <dt>Закуплено</dt>
                                                        <dd>
                                                            {t.purchasedQty >
                                                            0 ? (
                                                                <>
                                                                    {formatCount(
                                                                        t.purchasedQty
                                                                    )}{' '}
                                                                    шт.
                                                                    <small>
                                                                        {formatMoney(
                                                                            t.purchasedCost
                                                                        )}{' '}
                                                                        ₽
                                                                    </small>
                                                                </>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>Потрачено</dt>
                                                        <dd>
                                                            {t.usedQty > 0 ? (
                                                                <>
                                                                    {formatCount(
                                                                        t.usedQty
                                                                    )}{' '}
                                                                    шт.
                                                                    <small>
                                                                        {formatMoney(
                                                                            t.usedCost
                                                                        )}{' '}
                                                                        ₽
                                                                    </small>
                                                                </>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>Остаток</dt>
                                                        <dd>
                                                            {t.stockQty > 0 ? (
                                                                <>
                                                                    {formatCount(
                                                                        t.stockQty
                                                                    )}{' '}
                                                                    шт.
                                                                    <small>
                                                                        {formatMoney(
                                                                            t.stockValue
                                                                        )}{' '}
                                                                        ₽
                                                                    </small>
                                                                </>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </div>
                                        );
                                    })}
                                </div>

                                {materials.months.length > 0 && (
                                    <div className={cls.materialsChart}>
                                        <div className={cls.materialsLegend}>
                                            <span>
                                                <i
                                                    className={
                                                        cls.legendPurchase
                                                    }
                                                />
                                                Закуплено
                                            </span>
                                            <span>
                                                <i
                                                    className={cls.legendUsed}
                                                />
                                                Потрачено
                                            </span>
                                        </div>
                                        <ResponsiveContainer
                                            width="100%"
                                            height={160}
                                        >
                                            <BarChart
                                                data={materials.months}
                                                barGap={2}
                                                barCategoryGap="30%"
                                            >
                                                <CartesianGrid
                                                    stroke="rgba(255,255,255,0.06)"
                                                    vertical={false}
                                                />
                                                <XAxis
                                                    dataKey="label"
                                                    stroke="rgba(255,255,255,0.4)"
                                                    fontSize={11}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    stroke="rgba(255,255,255,0.4)"
                                                    fontSize={11}
                                                    width={56}
                                                    tickLine={false}
                                                    tickFormatter={(v) => {
                                                        const n = Number(v);
                                                        return n >= 1000
                                                            ? `${Math.round(n / 1000)}k ₽`
                                                            : `${n} ₽`;
                                                    }}
                                                />
                                                <Tooltip
                                                    cursor={{
                                                        fill: 'rgba(255,255,255,0.04)',
                                                    }}
                                                    contentStyle={{
                                                        background: '#141414',
                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                    }}
                                                    formatter={(
                                                        value: number,
                                                        name: string
                                                    ) => [
                                                        `${formatMoney(Number(value))} ₽`,
                                                        name === 'purchased'
                                                            ? 'Закуплено'
                                                            : 'Потрачено',
                                                    ]}
                                                />
                                                <Bar
                                                    dataKey="purchased"
                                                    fill="rgba(144, 164, 196, 0.75)"
                                                    radius={[3, 3, 0, 0]}
                                                    isAnimationActive={false}
                                                />
                                                <Bar
                                                    dataKey="used"
                                                    fill="#81C784"
                                                    radius={[3, 3, 0, 0]}
                                                    isAnimationActive={false}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    <div className={cls.tableCard} ref={movementsRef}>
                        <div className={cls.costChartHead}>
                            <h3 className={cls.chartTitle}>
                                Последние движения
                            </h3>
                            <div className={cls.movementFilters}>
                                <select
                                    className={cls.filterSelect}
                                    value={movementsPrinterFilter}
                                    onChange={(e) =>
                                        setMovementsPrinterFilter(
                                            e.target.value
                                        )
                                    }
                                    aria-label="Фильтр по аппарату"
                                >
                                    <option value="">Все аппараты</option>
                                    {movementMachines.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                                <div
                                    className={cls.costModeSwitch}
                                    role="group"
                                    aria-label="Тип движения"
                                >
                                    {[
                                        ['', 'Все'],
                                        ['purchase', 'Приход'],
                                        ['writeoff', 'Списание'],
                                        ['engineer', 'Инженер'],
                                    ].map(([val, label]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            className={
                                                movementsKindFilter === val
                                                    ? cls.costModeActive
                                                    : cls.costModeBtn
                                            }
                                            onClick={() =>
                                                setMovementsKindFilter(val)
                                            }
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {recent.length === 0 ? (
                            <div className={cls.empty}>
                                {movementsPrinterFilter || movementsKindFilter
                                    ? 'Нет движений по выбранному фильтру.'
                                    : 'Пока нет приходов и списаний. Оформите приход, замены или вызов инженера.'}
                            </div>
                        ) : (
                            <table className={cls.table}>
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Тип</th>
                                        <th>Категория</th>
                                        <th>Позиция</th>
                                        <th>Кол-во</th>
                                        <th>Сумма</th>
                                        <th>Экон.</th>
                                        <th>Аппарат</th>
                                        <th>Кто</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((m) => (
                                        <tr key={m.id}>
                                            <td>
                                                {new Date(
                                                    m.date
                                                ).toLocaleString('ru-RU')}
                                            </td>
                                            <td
                                                className={
                                                    m.kind === 'storno' ||
                                                    m.reversed
                                                        ? cls.kindWriteoff
                                                        : m.kind === 'purchase'
                                                          ? cls.kindPurchase
                                                          : m.kind ===
                                                              'engineer'
                                                            ? cls.kindEngineer
                                                            : cls.kindWriteoff
                                                }
                                            >
                                                {kindLabel(
                                                    m.kind,
                                                    m.reversed
                                                )}
                                            </td>
                                            <td>
                                                {COST_CATEGORY_LABELS[
                                                    m.costCategory
                                                ] || '—'}
                                            </td>
                                            <td>
                                                {m.type === 'toner'
                                                    ? `Тонер ${m.color || ''}`
                                                    : m.type === 'engineer'
                                                      ? m.partName ||
                                                        'Вызов инженера'
                                                      : `${m.partN || ''} ${
                                                            m.partName || ''
                                                        }`.trim()}
                                            </td>
                                            <td>{m.qty}</td>
                                            <td>
                                                {formatMoney(
                                                    Number(m.totalCost || 0)
                                                )}{' '}
                                                ₽
                                            </td>
                                            <td
                                                className={
                                                    (m.economyAmount || 0) > 0
                                                        ? cls.positive
                                                        : (m.economyAmount ||
                                                                0) < 0
                                                          ? cls.negative
                                                          : ''
                                                }
                                            >
                                                {m.economyAmount
                                                    ? `${formatSigned(
                                                          Number(
                                                              m.economyAmount
                                                          )
                                                      )} ₽`
                                                    : '—'}
                                            </td>
                                            <td>{m.machine || '—'}</td>
                                            <td>{m.man || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <InfiniteScrollSentinel
                            sentinelRef={recentSentinelRef}
                            hasMore={recentHasMore}
                            visibleCount={recentVisibleCount}
                            total={recentTotal}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default AnalyticsPage;
