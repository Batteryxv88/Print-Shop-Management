import type { Printer } from '../../../services/printers';
import type { StockMovement } from '../../../services/stockAccounting';
import type { CounterReadingRecord } from '../../../services/counterReadings';
import { isMaterialMovement } from '../stock/buildPrinterAnalytics';
import {
    activePrinterIdSet,
    getPrinterNameById,
    resolveMovementPrinterId,
    resolveUsagePrinterId,
} from './printerIdentity';

export { activePrinterIdSet };

export const isMovementForActivePrinters = (
    m: StockMovement,
    printers: Printer[]
): boolean => {
    /** Бумага и ламинация — общий склад, не в аналитике по аппаратам */
    if (isMaterialMovement(m)) return false;

    const activeIds = activePrinterIdSet(printers);
    const resolved = resolveMovementPrinterId(m, printers);

    return Boolean(resolved && activeIds.has(resolved));
};

export const filterMovementsForActivePrinters = (
    movements: StockMovement[],
    printers: Printer[]
): StockMovement[] =>
    movements.filter((m) => isMovementForActivePrinters(m, printers));

export const filterCounterReadingsForActivePrinters = (
    readings: CounterReadingRecord[],
    printers: Printer[]
): CounterReadingRecord[] => {
    const activeIds = activePrinterIdSet(printers);
    return readings.map((r) => ({
        ...r,
        printers: (r.printers || []).filter((p) => activeIds.has(p.printerId)),
    }));
};

export const filterUsageByPrinterId = <T>(
    items: T[],
    getRecord: (item: T) => { printerId?: string; machine?: string },
    printers: Printer[]
): T[] => {
    const activeIds = activePrinterIdSet(printers);
    return items.filter((item) => {
        const id = resolveUsagePrinterId(getRecord(item), printers);
        return Boolean(id && activeIds.has(id));
    });
};

export const displayMachineLabel = (
    m: { printerId?: string; machine?: string },
    printers: Printer[]
): string => {
    const id = (m.printerId || '').trim();
    if (id) {
        const name = getPrinterNameById(printers, id);
        if (name) return name;
    }
    return (m.machine || '').trim() || '—';
};
