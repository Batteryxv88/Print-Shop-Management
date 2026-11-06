import * as XLSX from 'xlsx';

export interface RotationFormImport {
    height: number;
    width: number;
    rows: number;
    shape: string;
    size_for_column: number;
    mark: string;
    height_without1: number;
    material: string;
    columns: number;
    comment: string;
    number: string;
}

export interface KnivesParseError {
    row: number;
    message: string;
}

export interface KnivesParseResult {
    forms: RotationFormImport[];
    errors: KnivesParseError[];
}

const SHAPE_BASES = ['прямоугольник', 'фигурная', 'квадрат', 'круг', 'овал'] as const;

const cleanCell = (value: unknown): string =>
    String(value ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeHeader = (value: unknown): string =>
    cleanCell(value)
        .toLowerCase()
        .replace(/ё/g, 'е');

const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = cleanCell(value).replace(',', '.');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
};

const findColumn = (headers: string[], predicate: (header: string) => boolean): number =>
    headers.findIndex(predicate);

export const normalizeMark = (raw: string): string => {
    const source = normalizeHeader(raw).replace(/x/g, 'х').replace(/×/g, 'х');
    if (!source) return '';

    const sizeMatch = source.match(/([3-9])\s*х\s*([3-9])/);
    const size = sizeMatch ? `${sizeMatch[1]}х${sizeMatch[2]}` : '';

    let side = '';
    if (source.includes('обеих') || source.includes('l r') || source.includes('lr')) {
        side = 'L R';
    } else if (source.includes('справа') || /\br\b/.test(source)) {
        side = 'R';
    } else if (source.includes('слева') || /\bl\b/.test(source)) {
        side = 'L';
    }

    if (size && side) return `${size} ${side}`;
    return cleanCell(raw);
};

export const normalizeMaterial = (raw: string): string => {
    const source = normalizeHeader(raw);
    if (source.startsWith('плен')) return 'пленка';
    if (source.startsWith('бума')) return 'бумага';
    return cleanCell(raw);
};

export const normalizeShape = (raw: string): { shape: string; detail: string } => {
    const original = cleanCell(raw);
    const fixed = original.replace(/прямоуголник/gi, 'прямоугольник');
    const lowered = normalizeHeader(fixed);

    for (const base of SHAPE_BASES) {
        if (lowered === base) return { shape: base, detail: '' };
        if (lowered.startsWith(base)) {
            return { shape: base, detail: fixed.slice(base.length).trim() };
        }
    }

    return { shape: original, detail: '' };
};

const appendDetail = (comment: string, detail: string): string => {
    const note = detail.trim();
    const meaningful = note.replace(/[\s/:,\-–—()]+/g, '');
    if (!meaningful) return comment.trim();
    const current = comment.trim();
    if (!current) return note;
    if (current.toLowerCase().includes(note.toLowerCase())) return current;
    return `${current} ${note}`;
};

const sheetRows = (sheet: XLSX.WorkSheet): unknown[][] =>
    XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
    }) as unknown[][];

const isKnivesSheet = (rows: unknown[][]): boolean => {
    const head = rows
        .slice(0, 6)
        .flat()
        .map(normalizeHeader)
        .join(' ');
    return head.includes('ручьи') && (head.includes('размер к ручью') || head.includes('к ручью'));
};

/**
 * Парсит Excel ножей (лист вроде «ножи для ПРОИЗВОДСТВА») в поля коллекции Forms.
 * Листы заказов без колонок ручьёв пропускаются.
 * Строки без высоты или длины попадают в errors, остальные формы возвращаются.
 */
export const parseKnivesExcel = (buffer: ArrayBuffer): KnivesParseResult => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames.find((name) =>
        isKnivesSheet(sheetRows(workbook.Sheets[name]))
    );

    if (!sheetName) {
        throw new Error(
            'В файле нет листа с формами (ожидаются колонки «Ручьи» и «Размер к ручью»)'
        );
    }

    const rows = sheetRows(workbook.Sheets[sheetName]);
    const headerRowIndex = rows.findIndex((row) =>
        row.some((cell) => {
            const header = normalizeHeader(cell);
            return header === 'ручьи' || header.startsWith('ручьи');
        })
    );

    if (headerRowIndex === -1) {
        throw new Error('Не найдена строка заголовков форм');
    }

    const headers = rows[headerRowIndex].map(normalizeHeader);
    const subRow = rows[headerRowIndex + 1] ?? [];
    const subHeaders = subRow.map(normalizeHeader);
    const hasSubHeader = subHeaders.some(
        (header) => header === 'высота' || header === 'длина' || header === 'ширина'
    );
    const sizeHeaders = hasSubHeader ? subHeaders : headers;

    const heightIdx = findColumn(sizeHeaders, (header) => header === 'высота');
    const widthIdx = findColumn(
        sizeHeaders,
        (header) => header === 'длина' || header === 'ширина'
    );
    const columnsIdx = findColumn(
        headers,
        (header) => header === 'ручьи' || header.startsWith('ручьи')
    );
    const rowsIdx = findColumn(
        headers,
        (header) => header.startsWith('повтор') || header === 'ряды'
    );
    const sizeForColumnIdx = findColumn(
        headers,
        (header) => header.includes('размер к ручью') || header.includes('к ручью')
    );
    const markIdx = findColumn(headers, (header) => header.startsWith('метк'));
    const shapeIdx = findColumn(headers, (header) => header === 'форма' || header.startsWith('форма'));
    const commentIdx = findColumn(headers, (header) => header.startsWith('коммент'));
    const heightWithoutIdx = findColumn(headers, (header) => header.includes('без 1'));
    const materialIdx = findColumn(headers, (header) => header.startsWith('материал'));
    const numberIdx = findColumn(headers, (header) => header.includes('номер'));

    if (heightIdx === -1 || widthIdx === -1 || columnsIdx === -1) {
        throw new Error(
            'Не найдены колонки форм (высота, длина, ручьи). Проверьте лист с ножами.'
        );
    }

    const dataStart = headerRowIndex + (hasSubHeader ? 2 : 1);
    const forms: RotationFormImport[] = [];
    const errors: KnivesParseError[] = [];

    for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i] ?? [];
        if (row.every((cell) => cleanCell(cell) === '')) continue;

        const excelRow = i + 1;
        const height = toNumber(row[heightIdx]);
        const width = toNumber(row[widthIdx]);

        if (height === null || height <= 0 || width === null || width <= 0) {
            errors.push({
                row: excelRow,
                message: `Строка ${excelRow}: нет высоты или длины`,
            });
            continue;
        }

        const comment = commentIdx >= 0 ? cleanCell(row[commentIdx]) : '';
        const { shape, detail } = normalizeShape(
            shapeIdx >= 0 ? cleanCell(row[shapeIdx]) : ''
        );

        forms.push({
            height,
            width,
            columns: columnsIdx >= 0 ? toNumber(row[columnsIdx]) ?? 0 : 0,
            rows: rowsIdx >= 0 ? toNumber(row[rowsIdx]) ?? 0 : 0,
            shape,
            size_for_column:
                sizeForColumnIdx >= 0 ? toNumber(row[sizeForColumnIdx]) ?? 0 : 0,
            mark: markIdx >= 0 ? normalizeMark(cleanCell(row[markIdx])) : '',
            height_without1:
                heightWithoutIdx >= 0 ? toNumber(row[heightWithoutIdx]) ?? 0 : 0,
            material: materialIdx >= 0 ? normalizeMaterial(cleanCell(row[materialIdx])) : '',
            comment: appendDetail(comment, detail),
            number: numberIdx >= 0 ? cleanCell(row[numberIdx]) : '',
        });
    }

    if (forms.length === 0) {
        throw new Error(
            errors.map((item) => item.message).join('\n') ||
                'В файле не найдено ни одной формы'
        );
    }

    return { forms, errors };
};
