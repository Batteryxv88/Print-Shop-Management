import type { ResourcePartRow } from './parsePartsExcel';

export type CollapsedPartGroup = {
    partN: string;
    partName: string;
    names: string[];
    section: string;
    partLife: string;
    installedQty: number;
};

const COLOR_SLASH = /\s*[/\\]\s*[A-Za-z0-9]{1,4}\s*$/;
const COLOR_LETTER = /\s+[CMYKcmky]\s*$/;

/** Снимает хвостовую пометку цвета: «/Y», «\M» или отдельную букву C/M/Y/K. */
export const stripColorMark = (name: string): string => {
    const trimmed = name.trim();
    const withoutSlash = trimmed.replace(COLOR_SLASH, '').trim();
    if (withoutSlash !== trimmed && withoutSlash.length > 0) return withoutSlash;
    const withoutLetter = trimmed.replace(COLOR_LETTER, '').trim();
    if (withoutLetter !== trimmed && withoutLetter.length > 0) return withoutLetter;
    return trimmed;
};

/** Имя общей складской карточки для группы одного артикула. */
export const warehouseNameFor = (names: string[]): string => {
    const list = names.map((name) => name.trim()).filter(Boolean);
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];

    const stripped = list.map(stripColorMark);
    const key = stripped[0].toLowerCase();
    const sameBase =
        key.length > 0 && stripped.every((name) => name.toLowerCase() === key);
    return sameBase ? stripped[0] : list[0];
};

const uniqueNames = (names: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    names.forEach((raw) => {
        const name = raw.trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
    });
    return out;
};

/** Строки ведомости с одним артикулом становятся одной складской группой. */
export const collapseResourceRows = (
    rows: ResourcePartRow[]
): CollapsedPartGroup[] => {
    const order: string[] = [];
    const groups = new Map<string, ResourcePartRow[]>();

    rows.forEach((row) => {
        const partN = row.partN.trim().toUpperCase();
        if (!partN) return;
        if (!groups.has(partN)) {
            groups.set(partN, []);
            order.push(partN);
        }
        groups.get(partN)!.push(row);
    });

    return order.map((partN) => {
        const items = groups.get(partN)!;
        const names = uniqueNames(items.map((row) => row.partName));
        const partLife =
            items.map((row) => row.partLife.trim()).find(Boolean) || '';
        const installedQty = items.reduce(
            (sum, row) => sum + (Number(row.installedQty) || 0),
            0
        );
        return {
            partN,
            partName: warehouseNameFor(names),
            names,
            section: items[0].section || 'Other',
            partLife,
            installedQty,
        };
    });
};
