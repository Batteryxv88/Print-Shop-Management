import { describe, expect, it } from 'vitest';

import {
    LAMINATION_CORE_MM,
    LAMINATION_FILM_MM,
    PAPER_CORE_MM,
    PAPER_FILM_MM,
    STANDARD_LENGTHS_M,
    rollLengthM,
    rollThicknessMm,
} from './rollThickness';

describe('rollThicknessMm', () => {
    it('matches the lamination thickness formula for 100 m of matte film', () => {
        const length = 100;
        const film = LAMINATION_FILM_MM.matte;
        const core = LAMINATION_CORE_MM;
        const expected =
            (Math.sqrt(core ** 2 + (4000 * film * length) / Math.PI) - core) / 2;

        expect(rollThicknessMm(core, film, length)).toBeCloseTo(expected, 10);
        expect(rollThicknessMm(core, film, length)).toBeCloseTo(8.83, 2);
    });

    it('round-trips length and thickness for paper', () => {
        const radial = rollThicknessMm(PAPER_CORE_MM, PAPER_FILM_MM.FA, 200);
        expect(rollLengthM(PAPER_CORE_MM, PAPER_FILM_MM.FA, radial)).toBeCloseTo(200, 6);
    });

    it('lists the shop meterages', () => {
        expect(STANDARD_LENGTHS_M).toEqual([
            30, 50, 75, 100, 135, 170, 200, 250, 300, 350, 400,
        ]);
    });
});
