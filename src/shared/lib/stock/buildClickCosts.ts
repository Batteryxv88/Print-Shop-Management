import type { PrintVolumeMonthRow } from '../counterReading/buildPrintVolume';
import { periodOverlapsDateRange } from '../counterReading/buildPrintVolume';
import type { ClickUnit } from '../../../services/printers';
import type { PrinterAnalyticsRow } from './buildPrinterAnalytics';

export type ClickCostRow = {
    printerId: string;
    name: string;
    model: string;
    /** Пусто, если у принтера единица клика не сохранена */
    clickUnit?: ClickUnit;
    /** Дельта общего счётчика за период, в единицах clickUnit */
    pages: number;
    /** Затраты «использовано» за период, ₽ */
    usedCost: number;
    /** ₽ / клик A4; null без листовой единицы или без объёма */
    clickA4: number | null;
    /** ₽ / клик A3; A3 = 2 клика A4 */
    clickA3: number | null;
    /** ₽ / метр; только если счётчик в метрах */
    clickMeter: number | null;
    purchasedTotal: number;
    economy: number;
};

const sheetPrices = (
    unit: ClickUnit,
    perCounter: number
): Pick<ClickCostRow, 'clickA4' | 'clickA3' | 'clickMeter'> => {
    if (unit === 'a4') {
        return {
            clickA4: perCounter,
            clickA3: perCounter * 2,
            clickMeter: null,
        };
    }
    if (unit === 'a3') {
        return {
            clickA4: perCounter / 2,
            clickA3: perCounter,
            clickMeter: null,
        };
    }
    return {
        clickA4: null,
        clickA3: null,
        clickMeter: perCounter,
    };
};

const emptyPrices = (): Pick<
    ClickCostRow,
    'clickA4' | 'clickA3' | 'clickMeter'
> => ({
    clickA4: null,
    clickA3: null,
    clickMeter: null,
});

/**
 * Себестоимость клика = использовано ₽ / дельта общего счётчика.
 * Без сохранённой единицы клика цены не считаются.
 * Объём берётся из месячных дельт счётчиков, пересекающих from–to.
 */
export const buildClickCosts = (
    printerRows: PrinterAnalyticsRow[],
    volumeRows: PrintVolumeMonthRow[],
    from: string,
    to: string,
    clickUnitByPrinterId: ReadonlyMap<string, ClickUnit | undefined>
): ClickCostRow[] => {
    const pagesByName = new Map<string, number>();

    volumeRows.forEach((row) => {
        if (!periodOverlapsDateRange(row.periodKey, from, to)) return;
        row.printers.forEach((p) => {
            const pages = Number(p.volume?.total) || 0;
            if (!(pages > 0)) return;
            pagesByName.set(p.name, (pagesByName.get(p.name) || 0) + pages);
        });
    });

    return printerRows
        .map((r) => {
            const pages = pagesByName.get(r.name) || 0;
            const usedCost = Number(r.usedTotal) || 0;
            const clickUnit = clickUnitByPrinterId.get(r.printerId);
            const perCounter =
                clickUnit && pages > 0 ? usedCost / pages : null;
            const prices =
                clickUnit && perCounter != null
                    ? sheetPrices(clickUnit, perCounter)
                    : emptyPrices();
            return {
                printerId: r.printerId,
                name: r.name,
                model: r.model,
                clickUnit,
                pages,
                usedCost,
                ...prices,
                purchasedTotal: Number(r.purchasedTotal) || 0,
                economy: Number(r.economy) || 0,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};
