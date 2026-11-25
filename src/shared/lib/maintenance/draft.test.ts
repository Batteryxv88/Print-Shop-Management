import { describe, expect, it } from 'vitest';
import { maintenanceDraftError, problemSummaryOf } from './draft';

describe('problemSummaryOf', () => {
    it('prefers the problem text and trims it', () => {
        expect(problemSummaryOf('  Полосы  ', 'разобрал', '')).toBe('Полосы');
    });

    it('falls back to work and then notes', () => {
        expect(problemSummaryOf(' ', 'Смазал', 'шумит')).toBe('Смазал');
        expect(problemSummaryOf('', '', '  шум  ')).toBe('шум');
    });

    it('cuts a long summary', () => {
        const long = 'а'.repeat(180);
        expect(problemSummaryOf(long, '', '')).toHaveLength(140);
        expect(problemSummaryOf(long, '', '').endsWith('…')).toBe(true);
    });
});

describe('maintenanceDraftError', () => {
    it('requires some text', () => {
        expect(
            maintenanceDraftError({
                problem: ' ',
                workDone: '',
                notes: '',
                status: 'new',
                neededCount: 0,
            })
        ).toMatch(/Заполните/);
    });

    it('requires work text when the status is done', () => {
        expect(
            maintenanceDraftError({
                problem: 'Полосы',
                workDone: ' ',
                notes: '',
                status: 'done',
                neededCount: 0,
            })
        ).toMatch(/Выполнено/);
    });

    it('requires a needed part while waiting', () => {
        expect(
            maintenanceDraftError({
                problem: 'Нет ролика',
                workDone: '',
                notes: '',
                status: 'waiting_parts',
                neededCount: 0,
            })
        ).toMatch(/Ожидает детали/);
    });

    it('accepts a new ticket with a problem', () => {
        expect(
            maintenanceDraftError({
                problem: 'Полосы',
                workDone: '',
                notes: '',
                status: 'new',
                neededCount: 0,
            })
        ).toBe('');
    });
});
