/**
 * Преобразует ресурс из Excel/склада в число для расчётов.
 * "21K" → 21000, "100K" → 100000, "2520K" → 2520000, "30000" → 30000
 */
export const parsePartLife = (life: string | number | null | undefined): number => {
    if (life === null || life === undefined || life === '') return 0;
    if (typeof life === 'number') return Number.isFinite(life) ? life : 0;

    const cleaned = String(life)
        .replace(/\u00a0/g, ' ')
        .trim()
        .replace(/\s+/g, '');

    const match = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*([KkКк])?$/);
    if (!match) {
        const n = Number(cleaned.replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    }

    const value = parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(value)) return 0;
    return match[2] ? value * 1000 : value;
};

/** Нормализует отображение ресурса: "21K ", "21k" → "21K" */
export const formatPartLifeDisplay = (
    life: string | number | null | undefined
): string => {
    if (life === null || life === undefined || life === '') return '';
    if (typeof life === 'number') {
        if (life >= 1000 && life % 1000 === 0) {
            return `${life / 1000}K`;
        }
        return String(life);
    }

    const cleaned = String(life).replace(/\u00a0/g, ' ').trim();
    const match = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*([KkКк])?$/i);
    if (!match) return cleaned;
    const num = match[1].replace(',', '.');
    return match[2] ? `${num}K` : num;
};
