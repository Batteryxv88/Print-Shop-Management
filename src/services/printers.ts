import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
    defaultColorsForMode,
    normalizeColorList,
    resolvePrinterColors,
    PrinterColorMode,
} from '../shared/lib/printers/tonerColors';

export type { PrinterColorMode };

/** В чём считается один клик общего счётчика */
export type ClickUnit = 'a4' | 'a3' | 'meter';

export const parseClickUnit = (value: unknown): ClickUnit | undefined =>
    value === 'a4' || value === 'a3' || value === 'meter' ? value : undefined;

export interface PrinterOption {
    id: string;
    model: string;
    serialNumber?: string;
}

export interface Printer {
    id: string;
    name: string;
    model: string;
    ip?: string;
    serialNumber?: string;
    options?: PrinterOption[];
    /** Чёрно-белый или цветной */
    colorMode: PrinterColorMode;
    /** Тонерные цвета: для color по умолчанию CMYK, можно добавить W и др. */
    colors: string[];
    /**
     * Единица общего счётчика. Пустое поле — цена клика не считается.
     */
    clickUnit?: ClickUnit;
}

export type PrinterInput = Omit<Printer, 'id'>;

const COLLECTION = 'Printers';

const normalizePrinterPayload = (printer: PrinterInput) => {
    const colorMode: PrinterColorMode =
        printer.colorMode === 'bw' ? 'bw' : 'color';
    const colors = normalizeColorList(
        printer.colors?.length
            ? printer.colors
            : defaultColorsForMode(colorMode)
    );
    const clickUnit = parseClickUnit(printer.clickUnit);

    return {
        name: printer.name.trim(),
        model: printer.model.trim(),
        ip: printer.ip?.trim() || '',
        serialNumber: printer.serialNumber?.trim() || '',
        options: (printer.options || []).map((opt) => ({
            id: opt.id,
            model: opt.model.trim(),
            serialNumber: opt.serialNumber?.trim() || '',
        })),
        colorMode,
        colors,
        ...(clickUnit ? { clickUnit } : {}),
    };
};

export const createOptionId = (): string =>
    `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const mapPrinterDoc = (id: string, data: Record<string, any>): Printer => {
    const colorMode: PrinterColorMode =
        data.colorMode === 'bw' ? 'bw' : 'color';
    const colors = resolvePrinterColors({
        colorMode,
        colors: Array.isArray(data.colors) ? data.colors : [],
    });

    return {
        id,
        name: data.name,
        model: data.model,
        ip: data.ip || '',
        serialNumber: data.serialNumber || '',
        options: Array.isArray(data.options) ? data.options : [],
        colorMode,
        colors,
        clickUnit: parseClickUnit(data.clickUnit),
    };
};

export const subscribeToPrinters = (callback: (printers: Printer[]) => void) => {
    const printersCollection = collection(db, COLLECTION);
    return onSnapshot(printersCollection, (snapshot) => {
        const printers = snapshot.docs.map((d) =>
            mapPrinterDoc(d.id, d.data())
        );

        printers.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        callback(printers);
    });
};

export const addPrinter = async (printer: PrinterInput): Promise<string> => {
    const payload = normalizePrinterPayload(printer);
    const ref = await addDoc(collection(db, COLLECTION), payload);
    await ensureTonerStockForModel(payload.model, payload.colors);
    return ref.id;
};

export const updatePrinter = async (
    id: string,
    printer: PrinterInput
): Promise<void> => {
    const payload = normalizePrinterPayload(printer);
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, payload);
    await ensureTonerStockForModel(payload.model, payload.colors);
};

export const deletePrinter = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION, id));
};

/** Создаёт склад тонеров для указанных цветов модели, если их ещё нет */
export const ensureTonerStockForModel = async (
    model: string,
    colors: string[] = [...defaultColorsForMode('color')]
): Promise<void> => {
    const tonersCollection = collection(db, 'TonersStorage');
    const snapshot = await getDocs(
        query(tonersCollection, where('model', '==', model))
    );
    const needed = normalizeColorList(colors);
    const existingColors = new Set(snapshot.docs.map((d) => d.data().color));

    const missing = needed.filter((c) => !existingColors.has(c));
    if (missing.length === 0) return;

    await Promise.all(
        missing.map((color) =>
            addDoc(tonersCollection, { color, qty: 0, model })
        )
    );
};
