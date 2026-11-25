import type { ResourcePartRow } from './parsePartsExcel';

export type AssemblyRole = 'main' | 'spoof';

export type AssemblyLine = {
    partName: string;
    needQty: number;
    partLife: string;
    section: string;
    code: string;
    role: AssemblyRole;
};

export type CollapsedPartGroup = {
    partN: string;
    partName: string;
    names: string[];
    section: string;
    partLife: string;
    installedQty: number;
    /** Помеченные строки того же артикула. На склад не складываются. */
    assemblyLines?: AssemblyLine[];
    /** Своя карточка узла, если артикул больше нигде без метки не встречается. */
    assemblyCode?: string;
    assemblyRole?: AssemblyRole;
};

const ASSEMBLY_MARK = /^(.+?)\s+(main|spoof)$/i;

/** «FB main» и «CHAR spoof»: код узла произвольный, хвост только main или spoof. */
export const parseAssemblyMark = (
    raw: string
): { code: string; role: AssemblyRole } | null => {
    const match = raw.trim().match(ASSEMBLY_MARK);
    if (!match) return null;
    const code = match[1].trim();
    if (!code) return null;
    const role = match[2].toLowerCase();
    if (role !== 'main' && role !== 'spoof') return null;
    return { code, role };
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

const sumQty = (items: ResourcePartRow[]): number =>
    items.reduce((sum, row) => sum + (Number(row.installedQty) || 0), 0);

const firstLife = (items: ResourcePartRow[]): string =>
    items.map((row) => row.partLife.trim()).find(Boolean) || '';

const toAssemblyLine = (row: ResourcePartRow): AssemblyLine | null => {
    const mark = parseAssemblyMark(row.spoof || '');
    if (!mark) return null;
    const partName = row.partName.trim();
    if (!partName) return null;
    return {
        partName,
        needQty: Number(row.installedQty) || 0,
        partLife: row.partLife.trim(),
        section: row.section || 'Other',
        code: mark.code,
        role: mark.role,
    };
};

/** Строки ведомости с одним артикулом становятся одной складской группой. */
export const collapseResourceRows = (
    rows: ResourcePartRow[]
): CollapsedPartGroup[] => {
    const order: string[] = [];
    const plain = new Map<string, ResourcePartRow[]>();
    const marked = new Map<string, ResourcePartRow[]>();

    rows.forEach((row) => {
        const partN = row.partN.trim().toUpperCase();
        if (!partN) return;
        const isMarked = Boolean(parseAssemblyMark(row.spoof || ''));
        if (!plain.has(partN) && !marked.has(partN)) order.push(partN);
        const bucket = isMarked ? marked : plain;
        if (!bucket.has(partN)) bucket.set(partN, []);
        bucket.get(partN)!.push(row);
    });

    return order.map((partN) => {
        const plainRows = plain.get(partN) ?? [];
        const markedRows = marked.get(partN) ?? [];
        const assemblyLines = markedRows
            .map(toAssemblyLine)
            .filter((line): line is AssemblyLine => line !== null);

        if (plainRows.length > 0) {
            const names = uniqueNames(plainRows.map((row) => row.partName));
            return {
                partN,
                partName: warehouseNameFor(names),
                names,
                section: plainRows[0].section || 'Other',
                partLife: firstLife(plainRows),
                installedQty: sumQty(plainRows),
                ...(assemblyLines.length ? { assemblyLines } : {}),
            };
        }

        const names = uniqueNames(markedRows.map((row) => row.partName));
        const ownMark = assemblyLines[0];
        return {
            partN,
            partName: names[0] || '',
            names,
            section: markedRows[0]?.section || 'Other',
            partLife: firstLife(markedRows),
            installedQty: sumQty(markedRows),
            ...(ownMark
                ? {
                      assemblyCode: ownMark.code,
                      assemblyRole: ownMark.role,
                  }
                : {}),
        };
    });
};
