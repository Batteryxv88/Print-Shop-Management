import {
    CMYK_COLORS,
    resolvePrinterColors,
    type PrinterColorMode,
} from '../printers/tonerColors';

export type CounterFieldKey = 'total' | 'mono' | 'color' | string;

export type CounterFieldDef = {
    key: CounterFieldKey;
    label: string;
};

export type PrinterCounterValues = {
    total: number;
    mono?: number;
    color?: number;
    /** Спец. цвета вне CMYK, например W */
    special?: Record<string, number>;
};

type PrinterLike = {
    colorMode?: PrinterColorMode;
    colors?: string[];
};

const CMYK_SET = new Set<string>(CMYK_COLORS);

export const specialColorLabel = (code: string): string => {
    const c = code.toUpperCase();
    if (c === 'W') return 'Белый (W)';
    return c;
};

/** Какие поля счётчиков нужны для принтера */
export const getCounterFieldsForPrinter = (
    printer: PrinterLike
): CounterFieldDef[] => {
    const mode = printer.colorMode === 'bw' ? 'bw' : 'color';
    if (mode === 'bw') {
        return [{ key: 'total', label: 'Общий' }];
    }

    const fields: CounterFieldDef[] = [
        { key: 'total', label: 'Общий' },
        { key: 'mono', label: 'Ч/Б' },
        { key: 'color', label: 'Цвет' },
    ];

    resolvePrinterColors(printer)
        .filter((c) => !CMYK_SET.has(c))
        .forEach((c) => {
            fields.push({ key: `special:${c}`, label: specialColorLabel(c) });
        });

    return fields;
};

export const emptyValuesFromFields = (
    fields: CounterFieldDef[]
): PrinterCounterValues => {
    const values: PrinterCounterValues = { total: 0 };
    fields.forEach((f) => {
        if (f.key === 'total') values.total = 0;
        else if (f.key === 'mono') values.mono = 0;
        else if (f.key === 'color') values.color = 0;
        else if (f.key.startsWith('special:')) {
            const code = f.key.slice('special:'.length);
            values.special = { ...(values.special || {}), [code]: 0 };
        }
    });
    return values;
};

export const getFieldValue = (
    values: PrinterCounterValues | undefined,
    key: CounterFieldKey
): number => {
    if (!values) return 0;
    if (key === 'total') return Number(values.total) || 0;
    if (key === 'mono') return Number(values.mono) || 0;
    if (key === 'color') return Number(values.color) || 0;
    if (key.startsWith('special:')) {
        const code = key.slice('special:'.length);
        return Number(values.special?.[code]) || 0;
    }
    return 0;
};

export const setFieldValue = (
    values: PrinterCounterValues,
    key: CounterFieldKey,
    raw: number
): PrinterCounterValues => {
    const n = Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
    if (key === 'total') return { ...values, total: n };
    if (key === 'mono') return { ...values, mono: n };
    if (key === 'color') return { ...values, color: n };
    if (key.startsWith('special:')) {
        const code = key.slice('special:'.length);
        return {
            ...values,
            special: { ...(values.special || {}), [code]: n },
        };
    }
    return values;
};

/** Дельта двух абсолютных показаний */
export const diffCounterValues = (
    current: PrinterCounterValues,
    previous: PrinterCounterValues | null | undefined
): PrinterCounterValues => {
    if (!previous) {
        return { ...current, special: { ...(current.special || {}) } };
    }
    const special: Record<string, number> = {};
    const codes = new Set([
        ...Object.keys(current.special || {}),
        ...Object.keys(previous.special || {}),
    ]);
    codes.forEach((code) => {
        special[code] = Math.max(
            0,
            (Number(current.special?.[code]) || 0) -
                (Number(previous.special?.[code]) || 0)
        );
    });
    return {
        total: Math.max(0, (Number(current.total) || 0) - (Number(previous.total) || 0)),
        mono:
            current.mono != null || previous.mono != null
                ? Math.max(
                      0,
                      (Number(current.mono) || 0) - (Number(previous.mono) || 0)
                  )
                : undefined,
        color:
            current.color != null || previous.color != null
                ? Math.max(
                      0,
                      (Number(current.color) || 0) -
                          (Number(previous.color) || 0)
                  )
                : undefined,
        special: Object.keys(special).length ? special : undefined,
    };
};
