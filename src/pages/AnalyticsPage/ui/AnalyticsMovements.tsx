import type { Ref, RefObject } from 'react';
import {
    COST_CATEGORY_LABELS,
} from '../../../shared/lib/stock/costCategory';
import { displayMachineLabel } from '../../../shared/lib/printers/activePrinterFilter';
import type { Printer } from '../../../services/printers';
import type { StockMovement } from '../../../services/stockAccounting';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';
import {
    formatMoney,
    formatSigned,
    movementKindLabel,
} from './analyticsFormatters';
import cls from './AnalyticsPage.module.scss';

type MovementPrinterOption = { id: string; name: string };

type AnalyticsMovementsProps = {
    movementsRef: RefObject<HTMLDivElement>;
    movementsPrinterFilter: string;
    setMovementsPrinterFilter: (v: string) => void;
    movementsKindFilter: string;
    setMovementsKindFilter: (v: string) => void;
    movementPrinterOptions: MovementPrinterOption[];
    recent: StockMovement[];
    recentSentinelRef: Ref<HTMLDivElement>;
    recentHasMore: boolean;
    recentVisibleCount: number;
    recentTotal: number;
    printers: Printer[];
};

const AnalyticsMovements = ({
    movementsRef,
    movementsPrinterFilter,
    setMovementsPrinterFilter,
    movementsKindFilter,
    setMovementsKindFilter,
    movementPrinterOptions,
    recent,
    recentSentinelRef,
    recentHasMore,
    recentVisibleCount,
    recentTotal,
    printers,
}: AnalyticsMovementsProps) => (
    <div className={cls.tableCard} ref={movementsRef}>
        <div className={cls.costChartHead}>
            <h3 className={cls.chartTitle}>Последние движения</h3>
            <div className={cls.movementFilters}>
                <select
                    className={cls.filterSelect}
                    value={movementsPrinterFilter}
                    onChange={(e) =>
                        setMovementsPrinterFilter(e.target.value)
                    }
                    aria-label="Фильтр по аппарату"
                >
                    <option value="">Все аппараты</option>
                    {movementPrinterOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
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
                            onClick={() => setMovementsKindFilter(val)}
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
                                {new Date(m.date).toLocaleString('ru-RU')}
                            </td>
                            <td
                                className={
                                    m.kind === 'storno' || m.reversed
                                        ? cls.kindWriteoff
                                        : m.kind === 'purchase'
                                          ? cls.kindPurchase
                                          : m.kind === 'engineer'
                                            ? cls.kindEngineer
                                            : cls.kindWriteoff
                                }
                            >
                                {movementKindLabel(
                                    m.kind,
                                    m.reversed,
                                    m.writeoffReason
                                )}
                            </td>
                            <td>
                                {COST_CATEGORY_LABELS[m.costCategory] || '—'}
                            </td>
                            <td>
                                {m.type === 'toner'
                                    ? `Тонер ${m.color || ''}`
                                    : m.type === 'engineer'
                                      ? m.partName || 'Вызов инженера'
                                      : `${m.partN || ''} ${m.partName || ''}`.trim()}
                            </td>
                            <td>{m.qty}</td>
                            <td>
                                {formatMoney(Number(m.totalCost || 0))} ₽
                            </td>
                            <td
                                className={
                                    (m.economyAmount || 0) > 0
                                        ? cls.positive
                                        : (m.economyAmount || 0) < 0
                                          ? cls.negative
                                          : ''
                                }
                            >
                                {m.economyAmount
                                    ? `${formatSigned(
                                          Number(m.economyAmount)
                                      )} ₽`
                                    : '—'}
                            </td>
                            <td>{displayMachineLabel(m, printers)}</td>
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
);

export default AnalyticsMovements;
