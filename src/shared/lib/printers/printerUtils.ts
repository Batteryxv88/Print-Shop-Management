import { Printer } from '../../../services/printers';

/** Уникальные модели принтеров (для вкладок склада) */
export const getUniqueModels = (printers: Printer[]): string[] => {
    const models: string[] = [];
    printers.forEach((p) => {
        const model = p.model?.trim();
        if (model && !models.includes(model)) {
            models.push(model);
        }
    });
    return models;
};

/** Модель принтера по его имени (machine key) */
export const getModelByPrinterName = (
    printers: Printer[],
    name: string
): string => {
    const printer = printers.find((p) => p.name === name);
    return printer?.model?.trim() || name;
};

/** Заголовок для экранов замены / отчёта */
export const getPrinterDisplayName = (
    printers: Printer[],
    name: string
): string => {
    const printer = printers.find((p) => p.name === name);
    if (!printer) return name;
    return printer.model
        ? `${printer.model} (${printer.name})`
        : printer.name;
};

/**
 * Фильтр склада по модели.
 * Записи без model — legacy (общий склад) — показываются для всех моделей,
 * чтобы не ломать существующие данные.
 */
export const matchesModel = (
    itemModel: string | undefined | null,
    selectedModel: string
): boolean => {
    if (!selectedModel) return true;
    if (!itemModel) return true;
    return itemModel === selectedModel;
};

/** Найти деталь на складе с учётом модели принтера */
export const findStockPart = (
    stockData: any[],
    partN: string,
    model: string,
    sameColorParts: string[]
): any | undefined => {
    const matchPartN = (item: any) => {
        if (sameColorParts.includes(partN)) {
            return item.part.partN === partN.slice(0, -1);
        }
        return item.part.partN === partN;
    };

    const modelSpecific = stockData.find(
        (item: any) => matchPartN(item) && item.part.model === model
    );
    if (modelSpecific) return modelSpecific;

    return stockData.find(
        (item: any) => matchPartN(item) && !item.part.model
    );
};

/** Найти тонер на складе с учётом модели */
export const findTonerStock = (
    tonersArr: any[],
    color: string,
    model: string
): any | undefined => {
    const modelSpecific = tonersArr.find(
        (item: any) =>
            item.toner.color === color && item.toner.model === model
    );
    if (modelSpecific) return modelSpecific;

    return tonersArr.find(
        (item: any) => item.toner.color === color && !item.toner.model
    );
};

/** Безопасное имя листа Excel (макс. 31 символ, без запрещённых символов) */
export const excelSheetName = (prefix: string, printerName: string): string => {
    const safeName = printerName.replace(/[\\/?*[\]:]/g, '_');
    const full = `${prefix} ${safeName}`;
    return full.length > 31 ? full.slice(0, 31) : full;
};
