import { formatPeriodLabel } from '../utils/counterReading';
import {
    diffCounterValues,
    type PrinterCounterValues,
} from './fields';
import type { CounterReadingRecord } from '../../../services/counterReadings';

export type PrintVolumePrinterPoint = {
    printerId: string;
    name: string;
    volume: PrinterCounterValues;
};

export type PrintVolumeMonthRow = {
    periodKey: string;
    label: string;
    /** dataKey → объём (общий) для линии */
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

/**
 * Строит точки объёма печати по месяцам:
 * объём за период = показание месяца − предыдущее показание.
 */
export const buildPrintVolumeSeries = (
    readings: CounterReadingRecord[],
    from?: string,
    to?: string
): PrintVolumeMonthRow[] => {
    const sorted = [...readings].sort((a, b) =>
        a.periodKey.localeCompare(b.periodKey)
    );
    if (sorted.length < 2) return [];

    const rows: PrintVolumeMonthRow[] = [];

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (from && to && !periodOverlapsDateRange(curr.periodKey, from, to)) {
            continue;
        }

        const prevMap = new Map(
            (prev.printers || []).map((p) => [p.printerId, p])
        );
        const points: PrintVolumePrinterPoint[] = [];

        (curr.printers || []).forEach((p) => {
            const before = prevMap.get(p.printerId);
            const volume = diffCounterValues(
                p.values,
                before?.values
            );
            points.push({
                printerId: p.printerId,
                name: p.printerName,
                volume,
            });
        });

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
