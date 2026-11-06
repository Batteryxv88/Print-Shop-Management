const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type CounterReadingSortable = {
    id?: string;
    dateKey?: string;
    periodKey: string;
};

/**
 * Ключ хронологии: день YYYY-MM-DD или первый день месяца для legacy YYYY-MM.
 */
export const sortKeyForReading = (r: CounterReadingSortable): string =>
    r.dateKey && DAY_RE.test(r.dateKey)
        ? r.dateKey
        : `${r.periodKey}-01`;

export const inferDateKeyAndPeriodFromDoc = (
    id: string,
    data: Record<string, unknown>
): { dateKey?: string; periodKey: string } => {
    const dk = data.dateKey ? String(data.dateKey) : '';
    if (dk && DAY_RE.test(dk)) {
        return { dateKey: dk, periodKey: dk.slice(0, 7) };
    }
    if (DAY_RE.test(id)) {
        return { dateKey: id, periodKey: id.slice(0, 7) };
    }
    if (MONTH_RE.test(id)) {
        return { periodKey: id };
    }
    const pk = String(data.periodKey || id);
    if (MONTH_RE.test(pk)) {
        return { periodKey: pk };
    }
    return { periodKey: pk };
};
