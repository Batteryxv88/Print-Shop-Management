import type { StockMovement } from '../../../services/stockAccounting';

export const pad = (n: number) => String(n).padStart(2, '0');

export const startOfDayIso = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toISOString();

export const endOfDayIso = (dateStr: string) =>
    new Date(`${dateStr}T23:59:59.999`).toISOString();

export const formatMoney = (n: number) =>
    n.toLocaleString('ru-RU', {
        maximumFractionDigits: 0,
    });

export const formatSigned = (n: number) => {
    const abs = formatMoney(Math.abs(n));
    if (n > 0) return `+${abs}`;
    if (n < 0) return `−${abs}`;
    return abs;
};

export const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

export const formatCount = (n: number) =>
    Math.round(n).toLocaleString('ru-RU');

export const pluralMovements = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'движение';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return 'движения';
    }
    return 'движений';
};

export const formatClick = (n: number) =>
    n.toLocaleString('ru-RU', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    });

export const movementKindLabel = (
    kind: string,
    reversed?: boolean,
    writeoffReason?: StockMovement['writeoffReason']
) => {
    if (kind === 'storno') return 'Сторно';
    if (kind === 'purchase') return 'Приход';
    if (kind === 'writeoff') {
        if (reversed) {
            return writeoffReason === 'scrap'
                ? 'Брак (отменено)'
                : 'Списание (отменено)';
        }
        return writeoffReason === 'scrap' ? 'Брак' : 'Списание';
    }
    if (kind === 'engineer') {
        return reversed ? 'Инженер (отменено)' : 'Инженер';
    }
    return kind;
};
