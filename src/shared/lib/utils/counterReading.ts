/** Последний день месяца */
export const daysInMonth = (year: number, monthIndex: number): number =>
    new Date(year, monthIndex + 1, 0).getDate();

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const toPeriodKey = (year: number, monthIndex: number): string =>
    `${year}-${pad2(monthIndex + 1)}`;

/** Дата снятия в указанном месяце (день clamp к длине месяца) */
export const getDueDate = (
    year: number,
    monthIndex: number,
    dayOfMonth: number
): Date => {
    const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, monthIndex));
    return new Date(year, monthIndex, day, 0, 0, 0, 0);
};

/**
 * Какой период сейчас «должен быть снят»:
 * — с дня due текущего месяца → текущий YYYY-MM
 * — до due текущего месяца → предыдущий месяц, если его due уже прошёл
 * — иначе null (ещё рано)
 */
export const getActivePeriodKey = (
    dayOfMonth: number | null | undefined,
    now: Date = new Date()
): string | null => {
    if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return null;

    const y = now.getFullYear();
    const m = now.getMonth();
    const dueThis = getDueDate(y, m, dayOfMonth);

    if (now >= dueThis) {
        return toPeriodKey(y, m);
    }

    const prev = new Date(y, m - 1, 1);
    const py = prev.getFullYear();
    const pm = prev.getMonth();
    const duePrev = getDueDate(py, pm, dayOfMonth);

    if (now > duePrev) {
        return toPeriodKey(py, pm);
    }

    return null;
};

export const isCounterReadingDoneForPeriod = (
    lastPeriodKey: string | null | undefined,
    activePeriodKey: string | null
): boolean => {
    if (!activePeriodKey) return true;
    if (!lastPeriodKey) return false;
    // YYYY-MM сравнимо лексикографически; снятие «вперёд» тоже закрывает текущий срок
    return lastPeriodKey >= activePeriodKey;
};

export const formatPeriodLabel = (periodKey: string): string => {
    const [y, m] = periodKey.split('-').map(Number);
    if (!y || !m) return periodKey;
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
};

export const getOverdueDays = (
    dayOfMonth: number,
    periodKey: string,
    now: Date = new Date()
): number => {
    const [y, m] = periodKey.split('-').map(Number);
    if (!y || !m) return 0;
    const due = getDueDate(y, m - 1, dayOfMonth);
    const ms = now.getTime() - due.getTime();
    if (ms <= 0) return 0;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
};
