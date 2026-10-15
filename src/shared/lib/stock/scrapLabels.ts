import type { StockItemType } from '../../../services/stockAccounting';

export type ScrapItemType = Extract<
    StockItemType,
    'part' | 'toner' | 'paper' | 'lamination'
>;

export const SCRAP_TYPE_LABELS: Record<ScrapItemType, string> = {
    part: 'Запчасть / расходка',
    toner: 'Тонер',
    paper: 'Бумага',
    lamination: 'Ламинация',
};

export const scrapItemLabel = (type: string, partName?: string): string => {
    const key = type as ScrapItemType;
    if (SCRAP_TYPE_LABELS[key]) {
        const base = SCRAP_TYPE_LABELS[key];
        if (partName?.trim()) return partName.trim();
        return base;
    }
    return partName?.trim() || type || '—';
};
