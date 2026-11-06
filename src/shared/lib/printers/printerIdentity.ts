import type { Printer } from '../../../services/printers';

export type PrinterRef = { id: string; name: string; model: string };

export const toPrinterRefs = (printers: Printer[]): PrinterRef[] =>
    printers.map((p) => ({
        id: p.id,
        name: p.name,
        model: (p.model || '').trim(),
    }));

/** Redux / UI: только id активного принтера из каталога */
export const resolveSelectedPrinterId = (
    value: string,
    printers: Printer[]
): string => {
    const v = (value || '').trim();
    if (v && printers.some((p) => p.id === v)) return v;
    return printers[0]?.id || '';
};

export const getPrinterById = (
    printers: Printer[],
    id: string
): Printer | undefined => printers.find((p) => p.id === id);

export const getPrinterNameById = (
    printers: Printer[],
    id: string
): string => getPrinterById(printers, id)?.name || '';

export const getModelByPrinterId = (
    printers: Printer[],
    id: string
): string => {
    const p = getPrinterById(printers, id);
    return p?.model?.trim() || p?.name || id;
};

export const getPrinterDisplayNameById = (
    printers: Printer[],
    id: string
): string => {
    const p = getPrinterById(printers, id);
    if (!p) return id;
    return p.model ? `${p.model} (${p.name})` : p.name;
};

type PrinterNameLookup = { id: string; name: string };

/** Движение склада → printerId (только явное поле) */
export const resolveMovementPrinterId = (
    m: { printerId?: string; machine?: string },
    _printers?: PrinterNameLookup[]
): string | null => {
    const direct = (m.printerId || '').trim();
    return direct || null;
};

/** Замена детали / тонера → printerId */
export const resolveUsagePrinterId = (
    record: { printerId?: string; machine?: string },
    _printers?: PrinterNameLookup[]
): string | null => {
    const direct = (record.printerId || '').trim();
    return direct || null;
};

export const usageMatchesSelectedPrinter = (
    record: { printerId?: string; machine?: string },
    selectedPrinterId: string,
    _printers?: Printer[]
): boolean => {
    const id = (record.printerId || '').trim();
    return Boolean(id && id === selectedPrinterId);
};

export const movementMatchesSelectedPrinter = (
    m: { printerId?: string; machine?: string },
    selectedPrinterId: string,
    _printers?: Printer[]
): boolean => {
    const id = (m.printerId || '').trim();
    return Boolean(id && id === selectedPrinterId);
};

export const activePrinterIdSet = (printers: Printer[]): Set<string> =>
    new Set(printers.map((p) => p.id).filter(Boolean));

export const printersForModel = (
    printers: Printer[],
    model: string
): Printer[] => {
    const m = (model || '').trim();
    if (!m) return [];
    return printers.filter((p) => (p.model || '').trim() === m);
};
