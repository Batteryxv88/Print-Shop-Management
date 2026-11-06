import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
    COST_CATEGORIES,
    COST_CATEGORY_COLORS,
    COST_CATEGORY_LABELS,
    type CostCategory,
} from '../../../shared/lib/stock/costCategory';
import type { PrinterAnalyticsRow } from '../../../shared/lib/stock/buildPrinterAnalytics';
import {
    sortedTonerColors,
    totalTonerUnits,
    type TonerUnits,
} from '../../../shared/lib/stock/buildTonerUnits';
import { getTonerSwatchColor } from '../../../shared/lib/printers/tonerColors';
import type { StockMovement } from '../../../services/stockAccounting';
import {
    formatClick,
    formatMoney,
    formatSigned,
    formatDateShort,
    pluralMovements,
    movementKindLabel,
} from './analyticsFormatters';
import cls from './AnalyticsPage.module.scss';

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

export type ClickCostRow = {
    name: string;
    clickCost: number | null;
    pages: number;
};

type AnalyticsCostsProps = {
    printerRows: PrinterAnalyticsRow[];
    setSelectedPrinter: (id: string) => void;
    selectedRow: PrinterAnalyticsRow | null;
    tonerUnitsByPrinter: Map<string, TonerUnits>;
    costMode: 'purchase' | 'used';
    focusedPrinter: string | null;
    focusPrinterOnCharts: (printerId: string) => void;
    showMovementsFor: (printerId: string) => void;
    clickCosts: ClickCostRow[];
    unattachedMovements: StockMovement[];
    unattachedTotal: number;
    showUnattached: boolean;
    setShowUnattached: Dispatch<SetStateAction<boolean>>;
};

const AnalyticsCosts = ({
    printerRows,
    setSelectedPrinter,
    selectedRow,
    tonerUnitsByPrinter,
    costMode,
    focusedPrinter,
    focusPrinterOnCharts,
    showMovementsFor,
    clickCosts,
    unattachedMovements,
    unattachedTotal,
    showUnattached,
    setShowUnattached,
}: AnalyticsCostsProps) => (
    <section className={cls.section}>
        <div className={cls.sectionHead}>
            <h2 className={cls.sectionTitle}>Затраты по принтерам</h2>
            <p className={cls.sectionHint}>
                Сводка за выбранный период. Закуплено — приходы склада (без
                привязки к аппарату делятся поровну между принтерами той же
                модели). Потрачено — замены, расходка, тонер и работа инженера
                по аппарату. Выберите принтер слева.
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
                        const active = selectedRow?.printerId === row.printerId;
                        const units = tonerUnitsByPrinter.get(row.printerId);
                        return (
                            <button
                                key={row.printerId}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                className={`${cls.printerListItem} ${
                                    active ? cls.printerListItemActive : ''
                                }`}
                                onClick={() =>
                                    setSelectedPrinter(row.printerId)
                                }
                            >
                                <span className={cls.printerListName}>
                                    <strong>{row.name}</strong>
                                    {row.model &&
                                        row.model !== row.name && (
                                            <small>{row.model}</small>
                                        )}
                                </span>
                                <span className={cls.printerListMeta}>
                                    <b>
                                        {row.usedTotal > 0
                                            ? `${formatMoney(row.usedTotal)} ₽`
                                            : '—'}
                                    </b>
                                    <small>
                                        {totalTonerUnits(units) > 0
                                            ? `${totalTonerUnits(units)} тон.`
                                            : 'потрачено'}
                                    </small>
                                </span>
                            </button>
                        );
                    })}
                </aside>

                {selectedRow && (
                    <div className={cls.printerDetail} key={selectedRow.name}>
                        <header className={cls.detailHead}>
                            <div>
                                <h3 className={cls.detailName}>
                                    {selectedRow.name}
                                </h3>
                                {selectedRow.model &&
                                    selectedRow.model !== selectedRow.name && (
                                        <span className={cls.detailModel}>
                                            {selectedRow.model}
                                        </span>
                                    )}
                            </div>
                            <div className={cls.detailsActions}>
                                <button
                                    type="button"
                                    className={`${cls.ghostBtn} ${
                                        focusedPrinter ===
                                        selectedRow.printerId
                                            ? cls.ghostBtnActive
                                            : ''
                                    }`}
                                    onClick={() =>
                                        focusPrinterOnCharts(
                                            selectedRow.printerId
                                        )
                                    }
                                >
                                    {focusedPrinter === selectedRow.printerId
                                        ? 'Все на графиках'
                                        : 'Только этот на графиках'}
                                </button>
                                <button
                                    type="button"
                                    className={cls.ghostBtn}
                                    onClick={() =>
                                        showMovementsFor(
                                            selectedRow.printerId
                                        )
                                    }
                                >
                                    Движения
                                </button>
                            </div>
                        </header>

                        {(() => {
                            const cc = clickCosts.find(
                                (c) => c.name === selectedRow.name
                            );
                            const units = tonerUnitsByPrinter.get(
                                selectedRow.printerId
                            );
                            return (
                                <div className={cls.tiles}>
                                    <StatTile
                                        label="Закуплено"
                                        active={costMode === 'purchase'}
                                    >
                                        {selectedRow.purchasedTotal > 0
                                            ? `${formatMoney(selectedRow.purchasedTotal)} ₽`
                                            : '—'}
                                    </StatTile>
                                    <StatTile
                                        label="Потрачено"
                                        active={costMode === 'used'}
                                    >
                                        {selectedRow.usedTotal > 0
                                            ? `${formatMoney(selectedRow.usedTotal)} ₽`
                                            : '—'}
                                    </StatTile>
                                    <StatTile
                                        label="₽ / клик"
                                        hint="Потрачено ₽ ÷ оттиски за период"
                                    >
                                        {cc?.clickCost != null
                                            ? formatClick(cc.clickCost)
                                            : '—'}
                                    </StatTile>
                                    <StatTile label="Оттиски">
                                        {cc && cc.pages > 0
                                            ? cc.pages.toLocaleString('ru-RU')
                                            : '—'}
                                    </StatTile>
                                    <StatTile
                                        label="Тонеры, шт."
                                        hint="Списано тонеров по цветам за период"
                                    >
                                        <TonerChips units={units} size="md" />
                                    </StatTile>
                                    <StatTile label="Замен запчастей">
                                        {selectedRow.replacements > 0
                                            ? selectedRow.replacements
                                            : '—'}
                                    </StatTile>
                                    <StatTile
                                        label="Экономия / перерасход"
                                        hint="По расходке: факт. ресурс vs заводской, в рублях FIFO-стоимости"
                                        tone={
                                            selectedRow.economy > 0
                                                ? 'positive'
                                                : selectedRow.economy < 0
                                                  ? 'negative'
                                                  : undefined
                                        }
                                    >
                                        {selectedRow.economy !== 0
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
                                    breakdown={selectedRow.purchased}
                                    total={selectedRow.purchasedTotal}
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
                    <span className={cls.unattachedIcon}>!</span>
                    <span className={cls.unattachedText}>
                        {unattachedMovements.length}{' '}
                        {pluralMovements(unattachedMovements.length)} на{' '}
                        {formatMoney(unattachedTotal)} ₽ без привязки к аппарату
                        — в сводку по принтерам не входят.
                    </span>
                    <button
                        type="button"
                        className={cls.ghostBtn}
                        onClick={() => setShowUnattached((v) => !v)}
                    >
                        {showUnattached ? 'Скрыть' : 'Показать'}
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
                                    {movementKindLabel(
                                        m.kind,
                                        m.reversed,
                                        m.writeoffReason
                                    )}
                                </span>
                                <span className={cls.unattachedName}>
                                    {m.type === 'toner'
                                        ? `Тонер ${m.color || ''}${
                                              m.model ? ` · ${m.model}` : ''
                                          }`
                                        : `${m.partN || ''} ${
                                              m.partName || ''
                                          }`.trim() || 'Вызов инженера'}
                                </span>
                                <b>
                                    {formatMoney(Number(m.totalCost))} ₽
                                </b>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )}
    </section>
);

export default AnalyticsCosts;
