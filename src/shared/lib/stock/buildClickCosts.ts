import type { PrintVolumeMonthRow } from '../counterReading/buildPrintVolume';
import { periodOverlapsDateRange } from '../counterReading/buildPrintVolume';
import type { PrinterAnalyticsRow } from './buildPrinterAnalytics';

export type ClickCostRow = {
    name: string;
    model: string;
    /** Оттиски (дельта общего счётчика) за период */
    pages: number;
    /** Затраты «использовано» за период, ₽ */
    usedCost: number;
    /** ₽ / оттиск; null если нет объёма */
    clickCost: number | null;
    purchasedTotal: number;
    economy: number;
};

/**
 * Себестоимость клика = использовано ₽ / объём печати (общий счётчик).
 * Объём берётся из месячных дельт счётчиков, пересекающих from–to.
 */
export const buildClickCosts = (
    printerRows: PrinterAnalyticsRow[],
    volumeRows: PrintVolumeMonthRow[],
    from: string,
    to: string
): ClickCostRow[] => {
    const pagesByName = new Map<string, number>();

    volumeRows.forEach((row) => {
        if (!periodOverlapsDateRange(row.periodKey, from, to)) return;
        row.printers.forEach((p) => {
            const pages = Number(p.volume?.total) || 0;
            if (!(pages > 0)) return;
            pagesByName.set(
                p.name,
                (pagesByName.get(p.name) || 0) + pages
            );
        });
    });

    return printerRows
        .map((r) => {
            const pages = pagesByName.get(r.name) || 0;
            const usedCost = Number(r.usedTotal) || 0;
            return {
                name: r.name,
                model: r.model,
                pages,
                usedCost,
                clickCost: pages > 0 ? usedCost / pages : null,
                purchasedTotal: Number(r.purchasedTotal) || 0,
                economy: Number(r.economy) || 0,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};
