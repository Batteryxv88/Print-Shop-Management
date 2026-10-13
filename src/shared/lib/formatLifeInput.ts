/** Только цифры из строки ресурса */
export const stripLifeDigits = (value: string | number | null | undefined): string =>
    String(value ?? '').replace(/\D/g, '');

/** 1028400 → 1,028,400 */
export const formatLifeWithCommas = (
    value: string | number | null | undefined
): string => {
    const digits = stripLifeDigits(value);
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** Числовое значение ресурса без сокращений (K) */
export const parseLifeExact = (
    value: string | number | null | undefined
): number => {
    const digits = stripLifeDigits(value);
    if (!digits) return 0;
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
};
