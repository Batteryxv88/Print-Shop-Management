/** Логика периода снятия — зеркало src/shared/lib/utils/counterReading.ts */

const pad2 = (n) => String(n).padStart(2, '0');

const daysInMonth = (year, monthIndex) =>
    new Date(year, monthIndex + 1, 0).getDate();

const toPeriodKey = (year, monthIndex) =>
    `${year}-${pad2(monthIndex + 1)}`;

const getDueDate = (year, monthIndex, dayOfMonth) => {
    const day = Math.min(
        Math.max(1, dayOfMonth),
        daysInMonth(year, monthIndex)
    );
    return new Date(year, monthIndex, day, 0, 0, 0, 0);
};

/**
 * Какой период сейчас должен быть снят (YYYY-MM), либо null если ещё рано.
 */
const getActivePeriodKey = (dayOfMonth, now = new Date()) => {
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

module.exports = {
    pad2,
    daysInMonth,
    toPeriodKey,
    getDueDate,
    getActivePeriodKey,
};
