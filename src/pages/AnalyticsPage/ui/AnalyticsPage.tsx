import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import { requestAnalyticsExport } from '../../../app/providers/StoreProvider/Store/AnalyticsFilterSlice';
import {
    useAppDispatch,
    useAppSelector,
    usePrinters,
    useTonerHistory,
    useUsedParts,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { usageEventsToMovements } from '../../../shared/lib/stock/usageEventsToMovements';
import {
    costChartFromIso,
    fetchMovementsInRange,
    fetchOpenLots,
    isActiveCostMovement,
    isProductionWriteoff,
    isScrapMovement,
    stockValueFromLots,
    StockLot,
    StockMovement,
} from '../../../services/stockAccounting';
import {
    fetchCounterReadingsForAnalytics,
    type CounterReadingRecord,
} from '../../../services/counterReadings';
import {
    buildPrinterAnalytics,
    collectUnattachedMovements,
    isMaterialMovement,
} from '../../../shared/lib/stock/buildPrinterAnalytics';
import {
    activePrinterIdSet,
    resolveMovementPrinterId,
    toPrinterRefs,
} from '../../../shared/lib/printers/printerIdentity';
import {
    filterCounterReadingsForActivePrinters,
    filterMovementsForActivePrinters,
    filterUsageByPrinterId,
} from '../../../shared/lib/printers/activePrinterFilter';
import { buildTonerUnits } from '../../../shared/lib/stock/buildTonerUnits';
import {
    buildMaterialsSummary,
    type MaterialKind,
} from '../../../shared/lib/stock/buildMaterialsSummary';
import {
    buildPrinterMonthlyCosts,
    costSeriesHasData,
    type CostMode,
} from '../../../shared/lib/stock/buildPrinterMonthlyCosts';
import { buildClickCosts } from '../../../shared/lib/stock/buildClickCosts';
import { exportAnalyticsExcel } from '../../../shared/lib/stock/exportAnalyticsExcel';
import {
    buildPrintVolumeChartSeries,
    buildPrintVolumeSeries,
    PRINTER_LINE_COLORS,
    type PrintVolumeChartGranularity,
} from '../../../shared/lib/counterReading/buildPrintVolume';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import { useIsMobile } from '../../../shared/lib/hooks/useBreakpoint';
import type { VolumeHoverTip, CostHoverTip } from './AnalyticsChartTooltips';
import AnalyticsOverview from './AnalyticsOverview';
import { startOfDayIso, endOfDayIso } from './analyticsFormatters';
import cls from './AnalyticsPage.module.scss';

const AnalyticsCharts = lazy(() => import('./AnalyticsCharts'));
const AnalyticsCosts = lazy(() => import('./AnalyticsCosts'));
const AnalyticsMaterials = lazy(() => import('./AnalyticsMaterials'));
const AnalyticsMovements = lazy(() => import('./AnalyticsMovements'));

export type AnalyticsTabId =
    | 'overview'
    | 'charts'
    | 'costs'
    | 'materials'
    | 'movements'
    | 'export';

const TAB_DEFS: { id: AnalyticsTabId; label: string }[] = [
    { id: 'overview', label: 'Обзор' },
    { id: 'charts', label: 'Графики' },
    { id: 'costs', label: 'Затраты' },
    { id: 'materials', label: 'Материалы' },
    { id: 'movements', label: 'Движения' },
    { id: 'export', label: 'Выгрузка' },
];

const AnalyticsPage = () => {
    const dispatch = useAppDispatch();
    dispatch(changePage('analytics'));
    const { printers } = usePrinters();
    const { usedPartsArray } = useUsedParts();
    const { tonersArray: tonerHistory } = useTonerHistory();
    const { from, to, refreshNonce, exportNonce } = useAppSelector(
        (state) => state.analyticsFilter
    );

    const isMobile = useIsMobile();

    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [costMovements, setCostMovements] = useState<StockMovement[]>([]);
    const [counterReadings, setCounterReadings] = useState<
        CounterReadingRecord[]
    >([]);
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
    const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
    const [focusedPrinter, setFocusedPrinter] = useState<string | null>(null);
    const [movementsPrinterFilter, setMovementsPrinterFilter] = useState('');
    const [movementsKindFilter, setMovementsKindFilter] = useState('');
    const movementsRef = useRef<HTMLDivElement>(null);
    const lastExportNonce = useRef(0);

    const [activeTab, setActiveTab] = useState<AnalyticsTabId>('charts');
    const [visitedTabs, setVisitedTabs] = useState<Set<AnalyticsTabId>>(
        () => new Set<AnalyticsTabId>(['overview', 'charts'])
    );
    const [volumeGranularity, setVolumeGranularity] =
        useState<PrintVolumeChartGranularity>('month');

    useEffect(() => {
        if (isMobile) {
            setActiveTab('overview');
        } else {
            setActiveTab('charts');
        }
    }, [isMobile]);

    const markTabVisited = useCallback((tab: AnalyticsTabId) => {
        setVisitedTabs((prev) => {
            if (prev.has(tab)) return prev;
            const next = new Set(prev);
            next.add(tab);
            return next;
        });
    }, []);

    useEffect(() => {
        markTabVisited(activeTab);
    }, [activeTab, markTabVisited]);

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
            const chartFrom = costChartFromIso(to);
            const rangeFrom = startOfDayIso(from);
            const rangeTo = endOfDayIso(to);
            const loadFrom = chartFrom < rangeFrom ? chartFrom : rangeFrom;

            const chartFromDate = chartFrom.slice(0, 10);
            const chartToDate = to;

            const [allMoves, lotsRes, readings] = await Promise.all([
                fetchMovementsInRange(loadFrom, rangeTo),
                fetchOpenLots(),
                fetchCounterReadingsForAnalytics(chartFromDate, chartToDate),
            ]);
            const moves = allMoves.filter(
                (m) => m.date >= rangeFrom && m.date <= rangeTo
            );
            setMovements(moves);
            setCostMovements(allMoves);
            setLots(lotsRes);
            setCounterReadings(readings);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                err &&
                typeof err === 'object' &&
                'message' in err &&
                typeof (err as { message: unknown }).message === 'string'
                    ? (err as { message: string }).message
                    : 'Не удалось загрузить аналитику. Проверьте индекс Firestore по полю date.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (refreshNonce > 0) {
            void load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- только кнопка «Обновить»
    }, [refreshNonce]);

    const printerRefs = useMemo(() => toPrinterRefs(printers), [printers]);
    const activeIds = useMemo(() => activePrinterIdSet(printers), [printers]);

    const stockValue = useMemo(() => {
        const boundLots = lots.filter((lot) => {
            const pid = (lot.printerId || '').trim();
            return Boolean(pid && activeIds.has(pid));
        });
        return stockValueFromLots(boundLots);
    }, [lots, activeIds]);

    const analyticsMovements = useMemo(
        () => filterMovementsForActivePrinters(movements, printers),
        [movements, printers]
    );

    const analyticsCostMovements = useMemo(
        () => filterMovementsForActivePrinters(costMovements, printers),
        [costMovements, printers]
    );

    const analyticsUsedParts = useMemo(
        () =>
            filterUsageByPrinterId(
                usedPartsArray,
                (item) => item.part,
                printers
            ),
        [usedPartsArray, printers]
    );

    const analyticsTonerHistory = useMemo(
        () =>
            filterUsageByPrinterId(
                tonerHistory,
                (item) => item.toner,
                printers
            ),
        [tonerHistory, printers]
    );

    const analyticsReadings = useMemo(
        () =>
            filterCounterReadingsForActivePrinters(
                counterReadings,
                printers
            ),
        [counterReadings, printers]
    );

    const printersCatalog = useMemo(
        () => printers.map((p) => ({ id: p.id, name: p.name })),
        [printers]
    );

    const { purchaseCost, usedCost, scrapCost, economyTotal } = useMemo(() => {
        let purchased = 0;
        let used = 0;
        let scrap = 0;
        let economy = 0;

        analyticsMovements.forEach((m) => {
            if (!isActiveCostMovement(m)) return;
            if (isMaterialMovement(m)) return;
            const amount = Number(m.totalCost) || 0;
            if (!(amount > 0)) return;

            const resolved = resolveMovementPrinterId(m, printersCatalog);
            if (!resolved || !activeIds.has(resolved)) return;

            if (m.kind === 'purchase') {
                purchased += amount;
                return;
            }
            if (m.kind === 'engineer') {
                used += amount;
                return;
            }
            if (isProductionWriteoff(m)) {
                used += amount;
                economy += Number(m.economyAmount) || 0;
                return;
            }
            if (isScrapMovement(m)) {
                scrap += amount;
            }
        });

        return {
            purchaseCost: purchased,
            usedCost: used,
            scrapCost: scrap,
            economyTotal: economy,
        };
    }, [analyticsMovements, printersCatalog, activeIds]);

    const chartFromDate = useMemo(
        () => costChartFromIso(to).slice(0, 10),
        [to]
    );

    const allVolumeRows = useMemo(
        () =>
            buildPrintVolumeSeries(
                analyticsReadings,
                chartFromDate,
                to,
                activeIds
            ),
        [analyticsReadings, chartFromDate, to, activeIds]
    );

    const volumeChartRows = useMemo(
        () =>
            buildPrintVolumeChartSeries(
                analyticsReadings,
                chartFromDate,
                to,
                activeIds,
                volumeGranularity
            ),
        [
            analyticsReadings,
            chartFromDate,
            to,
            activeIds,
            volumeGranularity,
        ]
    );

    const volumeChartTitle = useMemo(() => {
        if (volumeGranularity === 'day') return 'Объём печати (по дням)';
        if (volumeGranularity === 'week') return 'Объём печати (по неделям)';
        return 'Объём печати (по месяцам)';
    }, [volumeGranularity]);

    const printVolumePrinters = useMemo(() => {
        const map = new Map<string, string>();
        volumeChartRows.forEach((row) => {
            row.printers.forEach((p) => map.set(p.printerId, p.name));
        });
        return Array.from(map.entries()).map(([id, name], i) => ({
            id,
            name,
            color: PRINTER_LINE_COLORS[i % PRINTER_LINE_COLORS.length],
        }));
    }, [volumeChartRows]);

    const toggleVolumePrinter = (id: string) => {
        setHiddenVolumePrinters((prev) => {
            const next = { ...prev, [id]: !prev[id] };
            return next;
        });
        setVolumeHoverTip((tip) => (tip?.printerId === id ? null : tip));
    };

    const costSourceMovements = useMemo(() => {
        const byId = new Map<string, StockMovement>();
        [...analyticsCostMovements, ...analyticsMovements].forEach((m) => {
            if (m.id) byId.set(m.id, m);
        });
        return Array.from(byId.values());
    }, [analyticsCostMovements, analyticsMovements]);

    const usageExtraMovements = useMemo(
        () =>
            usageEventsToMovements(
                analyticsUsedParts,
                analyticsTonerHistory,
                costSourceMovements
            ),
        [analyticsUsedParts, analyticsTonerHistory, costSourceMovements]
    );

    const costMonthRows = useMemo(
        () =>
            buildPrinterMonthlyCosts(
                printerRefs,
                costSourceMovements,
                costMode,
                costMode === 'used' ? usageExtraMovements : []
            ),
        [printerRefs, costSourceMovements, costMode, usageExtraMovements]
    );

    const costChartHasData = useMemo(
        () => costSeriesHasData(costMonthRows),
        [costMonthRows]
    );

    const costChartPrinters = useMemo(
        () =>
            [...printers]
                .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                .map((p, i) => ({
                    id: p.id,
                    name: p.name,
                    color:
                        PRINTER_LINE_COLORS[i % PRINTER_LINE_COLORS.length],
                })),
        [printers]
    );

    const toggleCostPrinter = (id: string) => {
        setHiddenCostPrinters((prev) => ({ ...prev, [id]: !prev[id] }));
        setCostHoverTip((tip) => (tip?.printerName === id ? null : tip));
        setFocusedPrinter(null);
    };

    const focusPrinterOnCharts = (printerId: string) => {
        if (focusedPrinter === printerId) {
            setFocusedPrinter(null);
            setHiddenCostPrinters({});
            setHiddenVolumePrinters({});
            return;
        }
        setFocusedPrinter(printerId);
        const hiddenCost: Record<string, boolean> = {};
        costChartPrinters.forEach((p) => {
            if (p.id !== printerId) hiddenCost[p.id] = true;
        });
        setHiddenCostPrinters(hiddenCost);
        const hiddenVolume: Record<string, boolean> = {};
        printVolumePrinters.forEach((p) => {
            if (p.id !== printerId) hiddenVolume[p.id] = true;
        });
        setHiddenVolumePrinters(hiddenVolume);
        setCostHoverTip(null);
        setVolumeHoverTip(null);
    };

    const printerRows = useMemo(
        () => buildPrinterAnalytics(printerRefs, analyticsMovements),
        [printerRefs, analyticsMovements]
    );

    const tonerUnitsByPrinter = useMemo(
        () =>
            buildTonerUnits(
                analyticsMovements,
                analyticsTonerHistory,
                startOfDayIso(from),
                endOfDayIso(to),
                printerRefs
            ),
        [analyticsMovements, analyticsTonerHistory, from, to, printerRefs]
    );

    const unattachedMovements = useMemo(
        () => collectUnattachedMovements(printerRefs, analyticsMovements),
        [printerRefs, analyticsMovements]
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
        () =>
            buildMaterialsSummary(
                analyticsMovements,
                costSourceMovements,
                lots
            ),
        [analyticsMovements, costSourceMovements, lots]
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
            printerRows.find((r) => r.printerId === selectedPrinter) ||
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
                printerRefs,
                costSourceMovements,
                'purchase'
            ),
        [printerRefs, costSourceMovements]
    );

    const costUsedMonthRows = useMemo(
        () =>
            buildPrinterMonthlyCosts(
                printerRefs,
                costSourceMovements,
                'used',
                usageExtraMovements
            ),
        [printerRefs, costSourceMovements, usageExtraMovements]
    );

    const excelVolumeRows = useMemo(
        () => allVolumeRows.slice(-12),
        [allVolumeRows]
    );

    useEffect(() => {
        if (exportNonce === 0 || exportNonce === lastExportNonce.current) {
            return;
        }
        lastExportNonce.current = exportNonce;
        void exportAnalyticsExcel({
            from,
            to,
            printers,
            stockValue,
            printerRows,
            clickCosts,
            volumeRows: excelVolumeRows,
            costPurchaseRows: costPurchaseMonthRows,
            costUsedRows: costUsedMonthRows,
            movements: analyticsMovements,
            counterReadings: analyticsReadings,
            usedParts: analyticsUsedParts,
            tonerHistory: analyticsTonerHistory,
        }).catch((err: unknown) => {
            console.error(err);
            const msg =
                err &&
                typeof err === 'object' &&
                'message' in err &&
                typeof (err as { message: unknown }).message === 'string'
                    ? (err as { message: string }).message
                    : 'Не удалось выгрузить Excel. Попробуйте ещё раз.';
            setError(msg);
        });
    }, [
        exportNonce,
        from,
        to,
        stockValue,
        printerRows,
        clickCosts,
        excelVolumeRows,
        costPurchaseMonthRows,
        costUsedMonthRows,
        analyticsMovements,
        analyticsReadings,
        analyticsUsedParts,
        analyticsTonerHistory,
        printers,
    ]);

    const movementPrinterOptions = useMemo(
        () =>
            [...printers]
                .filter((p) => p.id && p.name)
                .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [printers]
    );

    const recentAll = useMemo(() => {
        const list = [...analyticsMovements].reverse();
        return list.filter((m) => {
            if (
                movementsPrinterFilter &&
                (m.printerId || '').trim() !== movementsPrinterFilter
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
    }, [analyticsMovements, movementsPrinterFilter, movementsKindFilter]);

    const showMovementsFor = (printerId: string) => {
        setMovementsPrinterFilter(printerId);
        setMovementsKindFilter('');
        setActiveTab('movements');
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

    const visibleTabs = isMobile
        ? TAB_DEFS.filter((t) => t.id === 'overview')
        : TAB_DEFS;

    const tabTriggerId = (id: AnalyticsTabId) => `analytics-tab-${id}-trigger`;
    const tabPanelDomId = (id: AnalyticsTabId) => `analytics-tab-${id}-panel`;

    const SuspenseBlock = ({
        children,
    }: {
        children: ReactNode;
    }) => (
        <Suspense fallback={<div className={cls.loading}>Загрузка…</div>}>
            {children}
        </Suspense>
    );

    return (
        <div className={cls.page} data-testid="analytics-root">
            <div className={cls.header}>
                <h1 className={cls.title}>Аналитика затрат</h1>
                {loading && (
                    <span className={cls.loadingHint}>Обновление…</span>
                )}
            </div>

            {error && <div className={cls.error}>{error}</div>}

            <AnalyticsOverview
                stockValue={stockValue}
                purchaseCost={purchaseCost}
                usedCost={usedCost}
                scrapCost={scrapCost}
                economyTotal={economyTotal}
            />

            {loading && movements.length === 0 ? (
                <div className={cls.loading}>Загрузка…</div>
            ) : (
                <>
                    {!isMobile && (
                        <>
                            <ul
                                className={cls.tabBar}
                                role="tablist"
                                aria-label="Разделы аналитики"
                            >
                                {visibleTabs.map((t) => (
                                    <li key={t.id} role="none">
                                        <button
                                            type="button"
                                            role="tab"
                                            id={tabTriggerId(t.id)}
                                            aria-selected={activeTab === t.id}
                                            aria-controls={tabPanelDomId(t.id)}
                                            className={`${cls.tab} ${
                                                activeTab === t.id
                                                    ? cls.tabActive
                                                    : ''
                                            }`}
                                            onClick={() => setActiveTab(t.id)}
                                        >
                                            {t.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div
                                className={cls.tabPanel}
                                role="tabpanel"
                                id={tabPanelDomId(activeTab)}
                                aria-labelledby={tabTriggerId(activeTab)}
                            >
                                {activeTab === 'overview' && (
                                    <p className={cls.sectionHint}>
                                        Период и кнопки «Обновить» / Excel —
                                        в боковой панели. Откройте вкладки
                                        ниже для графиков и таблиц.
                                    </p>
                                )}

                                {activeTab === 'charts' &&
                                    visitedTabs.has('charts') && (
                                        <SuspenseBlock>
                                            <AnalyticsCharts
                                                volumeChartTitle={
                                                    volumeChartTitle
                                                }
                                                volumeGranularity={
                                                    volumeGranularity
                                                }
                                                onVolumeGranularityChange={
                                                    setVolumeGranularity
                                                }
                                                printVolumeRows={
                                                    volumeChartRows
                                                }
                                                printVolumePrinters={
                                                    printVolumePrinters
                                                }
                                                hiddenVolumePrinters={
                                                    hiddenVolumePrinters
                                                }
                                                toggleVolumePrinter={
                                                    toggleVolumePrinter
                                                }
                                                volumeTipShown={volumeTipShown}
                                                volumeTipVisible={
                                                    volumeTipVisible
                                                }
                                                setVolumeHoverTip={
                                                    setVolumeHoverTip
                                                }
                                                costMode={costMode}
                                                setCostMode={setCostMode}
                                                costChartHasData={
                                                    costChartHasData
                                                }
                                                costMonthRows={costMonthRows}
                                                costChartPrinters={
                                                    costChartPrinters
                                                }
                                                hiddenCostPrinters={
                                                    hiddenCostPrinters
                                                }
                                                toggleCostPrinter={
                                                    toggleCostPrinter
                                                }
                                                costTipShown={costTipShown}
                                                costTipVisible={costTipVisible}
                                                setCostHoverTip={
                                                    setCostHoverTip
                                                }
                                            />
                                        </SuspenseBlock>
                                    )}

                                {activeTab === 'costs' &&
                                    visitedTabs.has('costs') && (
                                        <SuspenseBlock>
                                            <AnalyticsCosts
                                                printerRows={printerRows}
                                                setSelectedPrinter={
                                                    setSelectedPrinter
                                                }
                                                selectedRow={selectedRow}
                                                tonerUnitsByPrinter={
                                                    tonerUnitsByPrinter
                                                }
                                                costMode={costMode}
                                                focusedPrinter={focusedPrinter}
                                                focusPrinterOnCharts={
                                                    focusPrinterOnCharts
                                                }
                                                showMovementsFor={
                                                    showMovementsFor
                                                }
                                                clickCosts={clickCosts}
                                                unattachedMovements={
                                                    unattachedMovements
                                                }
                                                unattachedTotal={
                                                    unattachedTotal
                                                }
                                                showUnattached={showUnattached}
                                                setShowUnattached={
                                                    setShowUnattached
                                                }
                                            />
                                        </SuspenseBlock>
                                    )}

                                {activeTab === 'materials' &&
                                    materialKinds.length > 0 &&
                                    visitedTabs.has('materials') && (
                                        <SuspenseBlock>
                                            <AnalyticsMaterials
                                                materials={materials}
                                                materialKinds={materialKinds}
                                            />
                                        </SuspenseBlock>
                                    )}

                                {activeTab === 'materials' &&
                                    materialKinds.length === 0 && (
                                        <div className={cls.empty}>
                                            Нет данных по бумаге и ламинации
                                            за период или они отключены в
                                            настройках.
                                        </div>
                                    )}

                                {activeTab === 'movements' &&
                                    visitedTabs.has('movements') && (
                                        <SuspenseBlock>
                                            <AnalyticsMovements
                                                movementsRef={movementsRef}
                                                movementsPrinterFilter={
                                                    movementsPrinterFilter
                                                }
                                                setMovementsPrinterFilter={
                                                    setMovementsPrinterFilter
                                                }
                                                movementsKindFilter={
                                                    movementsKindFilter
                                                }
                                                setMovementsKindFilter={
                                                    setMovementsKindFilter
                                                }
                                                movementPrinterOptions={
                                                    movementPrinterOptions
                                                }
                                                recent={recent}
                                                recentSentinelRef={
                                                    recentSentinelRef
                                                }
                                                recentHasMore={recentHasMore}
                                                recentVisibleCount={
                                                    recentVisibleCount
                                                }
                                                recentTotal={recentTotal}
                                                printers={printers}
                                            />
                                        </SuspenseBlock>
                                    )}

                                {activeTab === 'export' && (
                                    <section className={cls.section}>
                                        <h2 className={cls.sectionTitle}>
                                            Выгрузка Excel
                                        </h2>
                                        <p className={cls.sectionHint}>
                                            Сводка по текущему периоду и KPI.
                                            Дублирует кнопку в боковой панели.
                                        </p>
                                        <button
                                            type="button"
                                            className={cls.ghostBtn}
                                            onClick={() =>
                                                dispatch(
                                                    requestAnalyticsExport()
                                                )
                                            }
                                        >
                                            Скачать Excel
                                        </button>
                                    </section>
                                )}
                            </div>
                        </>
                    )}

                </>
            )}
        </div>
    );
};

export default AnalyticsPage;
