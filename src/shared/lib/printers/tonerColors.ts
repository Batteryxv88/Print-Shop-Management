export type PrinterColorMode = 'bw' | 'color';

type PrinterColorFields = {
    colorMode?: PrinterColorMode;
    colors?: string[];
    model?: string;
    name?: string;
};

export const CMYK_COLORS = ['C', 'M', 'Y', 'K'] as const;
export const BW_COLORS = ['K'] as const;

/** Порядок базовых цветов, остальные — после них */
const BASE_ORDER = ['C', 'M', 'Y', 'K', 'W'];

export const normalizeColorCode = (raw: string): string =>
    raw.replace(/\u00a0/g, ' ').trim().toUpperCase();

export const normalizeColorList = (colors: string[]): string[] => {
    const unique: string[] = [];
    colors.forEach((c) => {
        const code = normalizeColorCode(c);
        if (code && !unique.includes(code)) unique.push(code);
    });

    return unique.sort((a, b) => {
        const ai = BASE_ORDER.indexOf(a);
        const bi = BASE_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
};

export const defaultColorsForMode = (mode: PrinterColorMode): string[] =>
    mode === 'bw' ? [...BW_COLORS] : [...CMYK_COLORS];

/** Цвета конкретного принтера с учётом legacy-записей без полей */
export const resolvePrinterColors = (
    printer?: PrinterColorFields | null
): string[] => {
    if (!printer) return [...CMYK_COLORS];
    if (printer.colors && printer.colors.length > 0) {
        return normalizeColorList(printer.colors);
    }
    return defaultColorsForMode(printer.colorMode || 'color');
};

/** Цвета для модели склада (объединение принтеров этой модели) */
export const getColorsForModel = (
    printers: PrinterColorFields[],
    model: string
): string[] => {
    const ofModel = printers.filter((p) => p.model === model);
    if (ofModel.length === 0) return [...CMYK_COLORS];

    const merged: string[] = [];
    ofModel.forEach((p) => {
        resolvePrinterColors(p).forEach((c) => {
            if (!merged.includes(c)) merged.push(c);
        });
    });
    return normalizeColorList(merged);
};

export const getColorsForPrinterName = (
    printers: Array<PrinterColorFields & { name?: string }>,
    printerName: string
): string[] => {
    const printer = printers.find((p) => p.name === printerName);
    return resolvePrinterColors(printer);
};

/** CSS-цвет для индикатора тонера */
export const getTonerSwatchColor = (color: string): string => {
    switch (normalizeColorCode(color)) {
        case 'C':
            return '#00BCD4';
        case 'M':
            return '#E91E63';
        case 'Y':
            return '#FFC107';
        case 'K':
            return '#212121';
        case 'W':
            return '#F5F5F5';
        default:
            return '#9E9E9E';
    }
};
