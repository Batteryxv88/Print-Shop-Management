import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    formatLotDate,
    formatLotDateShort,
    formatMoneyRu,
} from './formatLotDate';

describe('formatLotDate', () => {
    beforeAll(() => {
        process.env.TZ = 'UTC';
    });

    afterAll(() => {
        delete process.env.TZ;
    });

    it('formats valid ISO date in ru-RU', () => {
        expect(formatLotDate('2024-06-15T00:00:00.000Z')).toBe('15.06.2024');
    });

    it('returns em dash for empty invalid input', () => {
        expect(formatLotDate('')).toBe('—');
    });

    it('returns original string when date is invalid', () => {
        expect(formatLotDate('not-a-date')).toBe('not-a-date');
    });
});

describe('formatLotDateShort', () => {
    beforeAll(() => {
        process.env.TZ = 'UTC';
    });

    it('formats day and month only', () => {
        expect(formatLotDateShort('2024-06-15T00:00:00.000Z')).toBe('15.06');
    });

    it('returns em dash for invalid date', () => {
        expect(formatLotDateShort('nope')).toBe('—');
    });
});

describe('formatMoneyRu', () => {
    it('rounds and uses ru-RU grouping', () => {
        expect(formatMoneyRu(1234.4)).toBe(
            Math.round(1234.4).toLocaleString('ru-RU')
        );
        expect(formatMoneyRu(1000)).toBe(
            Math.round(1000).toLocaleString('ru-RU')
        );
    });

    it('rounds half up', () => {
        expect(formatMoneyRu(99.6)).toBe('100');
    });
});
