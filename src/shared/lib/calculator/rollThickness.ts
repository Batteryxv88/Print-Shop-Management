export const STANDARD_LENGTHS_M = [
    30, 50, 75, 100, 135, 170, 200, 250, 300, 350, 400,
] as const;

export const LAMINATION_CORE_MM = 90.3;
export const PAPER_CORE_MM = 96;

export const LAMINATION_FILM_MM = {
    matte: 0.0275,
    glossy: 0.03,
} as const;

export type PaperCode = 'FA' | 'FH' | 'PA' | 'PH' | 'Clear' | 'Metall' | 'Verge';

export const PAPER_FILM_MM: Record<PaperCode, number> = {
    FA: 0.1182,
    FH: 0.121,
    PA: 0.1245,
    PH: 0.1285,
    Clear: 0.123,
    Metall: 0.1096,
    Verge: 0.1837,
};

export const PAPER_CODES = Object.keys(PAPER_FILM_MM) as PaperCode[];

/** Радиальная толщина намотки, мм. */
export const rollThicknessMm = (
    coreMm: number,
    filmMm: number,
    lengthM: number
): number => {
    const inner = Math.sqrt(coreMm ** 2 + (4000 * filmMm * lengthM) / Math.PI);
    return (inner - coreMm) / 2;
};

/** Длина намотки, м, по радиальной толщине слоя. */
export const rollLengthM = (
    coreMm: number,
    filmMm: number,
    radialMm: number
): number => {
    const outer = coreMm + radialMm * 2;
    return (Math.PI * (outer ** 2 - coreMm ** 2)) / (4 * filmMm) / 1000;
};

export const formatMm = (value: number): string => value.toFixed(2);
