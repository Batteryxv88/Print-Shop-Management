export const formatLotDate = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || '—';
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

/** Короткая дата для подписей на графике */
export const formatLotDateShort = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
    });
};

export const formatMoneyRu = (n: number) =>
    Math.round(n).toLocaleString('ru-RU');
