import { parsePartLife } from '../printers/parsePartLife';

/** Категория затрат для аналитики */
export type CostCategory =
    | 'toner'
    | 'spare'
    | 'consumable'
    | 'engineer'
    | 'paper'
    | 'lamination';

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
    toner: 'Тонер',
    spare: 'Запчасти',
    consumable: 'Расходка',
    engineer: 'Инженер',
    paper: 'Бумага',
    lamination: 'Ламинация',
};

export const COST_CATEGORY_COLORS: Record<CostCategory, string> = {
    toner: '#64B5F6',
    spare: '#FFB74D',
    consumable: '#BB86FC',
    engineer: '#03DAC6',
    paper: '#81C784',
    lamination: '#4DD0E1',
};

export const COST_CATEGORIES: CostCategory[] = [
    'toner',
    'spare',
    'consumable',
    'engineer',
    'paper',
    'lamination',
];

export const emptyCategoryBreakdown = (): Record<CostCategory, number> => ({
    toner: 0,
    spare: 0,
    consumable: 0,
    engineer: 0,
    paper: 0,
    lamination: 0,
});

export const sumBreakdown = (b: Record<CostCategory, number>): number =>
    COST_CATEGORIES.reduce((s, key) => s + (b[key] || 0), 0);

/** Дефолт для детали: явная категория → иначе по наличию ресурса */
export const inferPartCostCategory = (part: {
    costCategory?: string;
    partLife?: string | number;
}): CostCategory => {
    if (part.costCategory === 'spare' || part.costCategory === 'consumable') {
        return part.costCategory;
    }
    return parsePartLife(part.partLife) > 0 ? 'consumable' : 'spare';
};

/**
 * Экономия (+) / перерасход (−) в рублях:
 * cost * (факт / завод − 1)
 */
export const calcLifeEconomy = (
    totalCost: number,
    factoryLife: number,
    actualLife: number
): number => {
    if (!(totalCost > 0) || !(factoryLife > 0) || !(actualLife > 0)) {
        return 0;
    }
    return totalCost * (actualLife / factoryLife - 1);
};
