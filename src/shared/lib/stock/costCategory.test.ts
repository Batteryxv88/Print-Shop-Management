import { describe, expect, it } from 'vitest';

import {
    calcLifeEconomy,
    emptyCategoryBreakdown,
    inferPartCostCategory,
    sumBreakdown,
} from './costCategory';

describe('calcLifeEconomy', () => {
    it('returns 0 when inputs are not positive', () => {
        expect(calcLifeEconomy(0, 1000, 2000)).toBe(0);
        expect(calcLifeEconomy(1000, 0, 2000)).toBe(0);
        expect(calcLifeEconomy(1000, 1000, 0)).toBe(0);
    });

    it('returns positive economy when actual life exceeds factory life', () => {
        expect(calcLifeEconomy(1000, 1000, 2000)).toBe(1000);
    });

    it('returns negative value when part worn faster than factory spec', () => {
        expect(calcLifeEconomy(1000, 1000, 500)).toBe(-500);
    });
});

describe('inferPartCostCategory', () => {
    it('respects explicit spare or consumable', () => {
        expect(inferPartCostCategory({ costCategory: 'spare' })).toBe('spare');
        expect(inferPartCostCategory({ costCategory: 'consumable' })).toBe(
            'consumable'
        );
    });

    it('uses consumable when part life is positive', () => {
        expect(inferPartCostCategory({ partLife: '21K' })).toBe('consumable');
    });

    it('uses spare when part life is missing or zero', () => {
        expect(inferPartCostCategory({})).toBe('spare');
        expect(inferPartCostCategory({ partLife: '' })).toBe('spare');
    });
});

describe('sumBreakdown', () => {
    it('sums all category buckets', () => {
        const b = emptyCategoryBreakdown();
        b.consumable = 100;
        b.spare = 50;
        expect(sumBreakdown(b)).toBe(150);
    });
});
