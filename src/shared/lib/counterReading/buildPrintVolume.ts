import { formatPeriodLabel } from '../utils/counterReading';
import type { CounterReadingRecord } from '../../../services/counterReadings';
import { sortKeyForReading } from './sortKey';
import {
    diffCounterValues,
    type PrinterCounterValues,
} from './fields';

export type PrintVolumePrinterPoint = {
    printerId: string;
    name: string;
    volume: PrinterCounterValues;
};

export type PrintVolumeMonthRow = {
    /** YYYY-MM для столбца «по месяцам» (legacy) или внутренний ключ */
    periodKey: string;
    label: string;
    /** dataKey → объём (общий) для линии */
    [printerId: string]: string | number | PrintVolumePrinterPoint[] | undefined;
    printers: PrintVolumePrinterPoint[];
};

export type PrintVolumeDayRow = {
    dateKey: string;
    label: string;
    [printerId: string]: string | number | PrintVolumePrinterPoint[] | undefined;
    printers: PrintVolumePrinterPoint[];
};

const periodStart = (periodKey: string): string => `${periodKey}-01`;

const periodEnd = (periodKey: string): string => {
    const [y, m] = periodKey.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${periodKey}-${String(last).padStart(2, '0')}`;
};

export const periodOverlapsDateRange = (
    periodKey: string,
    from: string,
    to: string
): boolean => {
    const start = periodStart(periodKey);
    const end = periodEnd(periodKey);
    return start <= to && end >= from;
};

const diffRow = (
    curr: CounterReadingRecord,
    prev: CounterReadingRecord | undefined,
    activePrinterIds?: Set<string>
): PrintVolumePrinterPoint[] => {
    if (!prev) return [];
    const prevMap = new Map(
        (prev.printers || []).map((p) => [p.printerId, p])
    );
    const points: PrintVolumePrinterPoint[] = [];

    (curr.printers || []).forEach((p) => {
        if (activePrinterIds && !activePrinterIds.has(p.printerId)) {
            return;
        }
        const before = prevMap.get(p.printerId);
        const volume = diffCounterValues(p.values, before?.values);
        points.push({
            printerId: p.printerId,
            name: p.printerName,
            volume,
        });
    });

    return points;
};

const addVolumes = (
    a: PrinterCounterValues,
    b: PrinterCounterValues
): PrinterCounterValues => {
    const out: PrinterCounterValues = {
        total: (Number(a.total) || 0) + (Number(b.total) || 0),
    };
    if (a.mono != null || b.mono != null) {
        out.mono = (Number(a.mono) || 0) + (Number(b.mono) || 0);
    }
    if (a.color != null || b.color != null) {
        out.color = (Number(a.color) || 0) + (Number(b.color) || 0);
    }
    const keys = new Set([
        ...Object.keys(a.special || {}),
        ...Object.keys(b.special || {}),
    ]);
    if (keys.size > 0) {
        out.special = {};
        keys.forEach((k) => {
            out.special![k] =
                (Number(a.special?.[k]) || 0) + (Number(b.special?.[k]) || 0);
        });
    }
    return out;
};

/**
 * Объём между двумя последовательными снимками (по sortKey).
 */
export const buildPrintVolumeDailySeries = (
    readings: CounterReadingRecord[],
    from?: string,
    to?: string,
    activePrinterIds?: Set<string>
): PrintVolumeDayRow[] => {
    const sorted = [...readings].sort((a, b) =>
        sortKeyForReading(a).localeCompare(sortKeyForReading(b))
    );
    if (sorted.length < 2) return [];

    const rows: PrintVolumeDayRow[] = [];

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const currKey = sortKeyForReading(curr);
        if (from && to && (currKey < from || currKey > to)) {
            continue;
        }

        const points = diffRow(curr, prev, activePrinterIds);
        if (points.length === 0) continue;

        const d = new Date(`${currKey}T12:00:00`);
        const label = d.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
        });

        const row: PrintVolumeDayRow = {
            dateKey: currKey,
            label,
            printers: points,
        };
        points.forEach((p) => {
            row[p.printerId] = p.volume.total;
        });
        rows.push(row);
    }

    return rows;
};

/**
 * Агрегация дневных объёмов по календарным месяцам (сумма дельт).
 */
export const aggregateDailyVolumesToMonths = (
    dailyRows: PrintVolumeDayRow[],
    fromDateKey?: string,
    toDateKey?: string
): PrintVolumeMonthRow[] => {
    type Acc = {
        label: string;
        byPrinter: Map<string, { name: string; volume: PrinterCounterValues }>;
    };
    const months = new Map<string, Acc>();

    dailyRows.forEach((row) => {
        if (fromDateKey && row.dateKey < fromDateKey) return;
        if (toDateKey && row.dateKey > toDateKey) return;
        const monthKey = row.dateKey.slice(0, 7);
        if (!months.has(monthKey)) {
            months.set(monthKey, {
                label: formatPeriodLabel(monthKey),
                byPrinter: new Map(),
            });
        }
        const acc = months.get(monthKey)!;
        row.printers.forEach((p) => {
            const cur = acc.byPrinter.get(p.printerId) || {
                name: p.name,
                volume: {
                    total: 0,
                    ...(p.volume.mono != null ? { mono: 0 } : {}),
                    ...(p.volume.color != null ? { color: 0 } : {}),
                },
            };
            cur.volume = addVolumes(cur.volume, p.volume);
            acc.byPrinter.set(p.printerId, cur);
        });
    });

    return Array.from(months.keys())
        .sort()
        .map((periodKey) => {
            const acc = months.get(periodKey)!;
            const printers: PrintVolumePrinterPoint[] = Array.from(
                acc.byPrinter.entries()
            ).map(([printerId, { name, volume }]) => ({
                printerId,
                name,
                volume,
            }));
            const row: PrintVolumeMonthRow = {
                periodKey,
                label: acc.label,
                printers,
            };
            printers.forEach((p) => {
                row[p.printerId] = p.volume.total;
            });
            return row;
        });
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Понедельник недели, содержащей dateKey (локальная дата) — YYYY-MM-DD */
const weekStartKey = (dateKey: string): string => {
    const d = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateKey;
    const day = d.getDay();
    const mondayOffset = (day + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Агрегация дневных объёмов по календарным неделям (сумма дельт, ключ — понедельник недели).
 */
export const aggregateDailyVolumesToWeeks = (
    dailyRows: PrintVolumeDayRow[],
    fromDateKey?: string,
    toDateKey?: string
): PrintVolumeMonthRow[] => {
    type Acc = {
        label: string;
        byPrinter: Map<string, { name: string; volume: PrinterCounterValues }>;
    };
    const weeks = new Map<string, Acc>();

    dailyRows.forEach((row) => {
        if (fromDateKey && row.dateKey < fromDateKey) return;
        if (toDateKey && row.dateKey > toDateKey) return;
        const wk = weekStartKey(row.dateKey);
        if (!weeks.has(wk)) {
            const start = new Date(`${wk}T12:00:00`);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            const label = `${start.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'short',
            })}–${end.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'short',
            })}`;
            weeks.set(wk, {
                label,
                byPrinter: new Map(),
            });
        }
        const acc = weeks.get(wk)!;
        row.printers.forEach((p) => {
            const cur = acc.byPrinter.get(p.printerId) || {
                name: p.name,
                volume: {
                    total: 0,
                    ...(p.volume.mono != null ? { mono: 0 } : {}),
                    ...(p.volume.color != null ? { color: 0 } : {}),
                },
            };
            cur.volume = addVolumes(cur.volume, p.volume);
            acc.byPrinter.set(p.printerId, cur);
        });
    });

    return Array.from(weeks.keys())
        .sort()
        .map((periodKey) => {
            const acc = weeks.get(periodKey)!;
            const printers: PrintVolumePrinterPoint[] = Array.from(
                acc.byPrinter.entries()
            ).map(([printerId, { name, volume }]) => ({
                printerId,
                name,
                volume,
            }));
            const row: PrintVolumeMonthRow = {
                periodKey,
                label: acc.label,
                printers,
            };
            printers.forEach((p) => {
                row[p.printerId] = p.volume.total;
            });
            return row;
        });
};

const dailyRowsToVolumeChartRows = (
    dailyRows: PrintVolumeDayRow[]
): PrintVolumeMonthRow[] =>
    dailyRows.map((dr) => {
        const row: PrintVolumeMonthRow = {
            periodKey: dr.dateKey,
            label: dr.label,
            printers: dr.printers,
        };
        dr.printers.forEach((p) => {
            row[p.printerId] = p.volume.total;
        });
        return row;
});

export type PrintVolumeChartGranularity = 'day' | 'week' | 'month';

/**
 * Серия для графика объёма с выбором шага агрегации (день / неделя / месяц).
 * Недельный и дневной режимы строятся только из дневных снимков; при их отсутствии — пусто.
 */
export const buildPrintVolumeChartSeries = (
    readings: CounterReadingRecord[],
    from: string | undefined,
    to: string | undefined,
    activePrinterIds: Set<string> | undefined,
    granularity: PrintVolumeChartGranularity
): PrintVolumeMonthRow[] => {
    const sorted = [...readings].sort((a, b) =>
        sortKeyForReading(a).localeCompare(sortKeyForReading(b))
    );
    const dailySorted = sorted.filter((r) => r.dateKey);
    const dailyRows = buildPrintVolumeDailySeries(
        dailySorted,
        from,
        to,
        activePrinterIds
    );

    if (granularity === 'day') {
        return dailyRowsToVolumeChartRows(dailyRows);
    }
    if (granularity === 'week') {
        return aggregateDailyVolumesToWeeks(dailyRows, from, to);
    }
    return buildPrintVolumeSeries(readings, from, to, activePrinterIds);
};

/**
 * Серия для графика «по месяцам»: из дневных снимков — дневные дельты, затем сумма по месяцам;
 * при отсутствии дневных данных на участке используются только legacy месячные пары.
 */
export const buildPrintVolumeSeries = (
    readings: CounterReadingRecord[],
    from?: string,
    to?: string,
    activePrinterIds?: Set<string>
): PrintVolumeMonthRow[] => {
    const sorted = [...readings].sort((a, b) =>
        sortKeyForReading(a).localeCompare(sortKeyForReading(b))
    );

    const dailySorted = sorted.filter((r) => r.dateKey);
    const legacySorted = sorted.filter((r) => !r.dateKey);

    const dailyRows = buildPrintVolumeDailySeries(
        dailySorted,
        from,
        to,
        activePrinterIds
    );
    const fromMonth = from?.slice(0, 7);
    const toMonth = to?.slice(0, 7);

    let monthRows = aggregateDailyVolumesToMonths(dailyRows, from, to);
    if (fromMonth && toMonth) {
        monthRows = monthRows.filter(
            (r) => r.periodKey >= fromMonth && r.periodKey <= toMonth
        );
    }

    if (monthRows.length > 0 || legacySorted.length < 2) {
        return monthRows;
    }

    const rows: PrintVolumeMonthRow[] = [];
    for (let i = 1; i < legacySorted.length; i++) {
        const prev = legacySorted[i - 1];
        const curr = legacySorted[i];
        if (
            from &&
            to &&
            !periodOverlapsDateRange(curr.periodKey, from, to)
        ) {
            continue;
        }
        const points = diffRow(curr, prev, activePrinterIds);
        if (points.length === 0) continue;
        const row: PrintVolumeMonthRow = {
            periodKey: curr.periodKey,
            label: formatPeriodLabel(curr.periodKey),
            printers: points,
        };
        points.forEach((p) => {
            row[p.printerId] = p.volume.total;
        });
        rows.push(row);
    }
    return rows;
};

/** Палитра линий для принтеров */
export const PRINTER_LINE_COLORS = [
    '#BB86FC',
    '#03DAC6',
    '#FFB74D',
    '#64B5F6',
    '#EF9A9A',
    '#AED581',
    '#F48FB1',
    '#80CBC4',
    '#FFD54F',
    '#90CAF9',
];
