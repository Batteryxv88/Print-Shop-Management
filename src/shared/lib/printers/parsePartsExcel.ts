import * as XLSX from 'xlsx';
import { formatPartLifeDisplay } from './parsePartLife';

export interface ResourcePartRow {
    section: string;
    partName: string;
    partN: string;
    partLife: string;
    installedQty: number;
}

const cleanCell = (value: unknown): string =>
    String(value ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeHeader = (value: unknown): string =>
    cleanCell(value).toLowerCase().replace(/[.\s]+/g, ' ');

const findColumnIndex = (
    headers: string[],
    candidates: string[]
): number => {
    for (const candidate of candidates) {
        const idx = headers.findIndex((h) => h.includes(candidate));
        if (idx !== -1) return idx;
    }
    return -1;
};

/**
 * Парсит Excel ресурсных деталей (как Label 400.xlsx).
 * Ожидаемые колонки: Section, PM Parts Name, Qty, Replace, Parts No.
 * Пустая Section наследует предыдущую.
 */
export const parsePartsExcel = (buffer: ArrayBuffer): ResourcePartRow[] => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('В файле нет листов');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
    }) as unknown[][];

    if (!rows.length) {
        throw new Error('Файл пустой');
    }

    let headerRowIndex = rows.findIndex((row) => {
        const headers = row.map(normalizeHeader);
        return (
            findColumnIndex(headers, ['parts no', 'part no', 'парт']) !== -1 ||
            findColumnIndex(headers, ['pm parts name', 'parts name']) !== -1
        );
    });

    if (headerRowIndex === -1) headerRowIndex = 0;

    const headers = rows[headerRowIndex].map(normalizeHeader);
    const sectionIdx = findColumnIndex(headers, ['section', 'секц']);
    const nameIdx = findColumnIndex(headers, [
        'pm parts name',
        'parts name',
        'part name',
        'наименован',
        'name',
    ]);
    const qtyIdx = findColumnIndex(headers, ['qty', 'кол']);
    const lifeIdx = findColumnIndex(headers, [
        'replace',
        'ресурс',
        'part life',
        'life',
    ]);
    const partNIdx = findColumnIndex(headers, [
        'parts no',
        'part no',
        'partn',
        'парт',
        'артикул',
    ]);

    if (nameIdx === -1 || partNIdx === -1) {
        throw new Error(
            'Не найдены обязательные колонки (Parts Name / Parts No.). Проверьте формат файла.'
        );
    }

    const result: ResourcePartRow[] = [];
    let currentSection = '';

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((cell) => cleanCell(cell) === '')) continue;

        const sectionRaw = sectionIdx >= 0 ? cleanCell(row[sectionIdx]) : '';
        if (sectionRaw) currentSection = sectionRaw;

        const partName = cleanCell(row[nameIdx]);
        const partN = cleanCell(row[partNIdx]).toUpperCase();
        if (!partName || !partN) continue;

        const qtyRaw = qtyIdx >= 0 ? cleanCell(row[qtyIdx]) : '1';
        const installedQty = Math.max(0, parseInt(qtyRaw, 10) || 0);

        const lifeRaw = lifeIdx >= 0 ? cleanCell(row[lifeIdx]) : '';
        const partLife = formatPartLifeDisplay(lifeRaw) || lifeRaw;

        result.push({
            section: currentSection || 'Other',
            partName,
            partN,
            partLife,
            installedQty,
        });
    }

    if (result.length === 0) {
        throw new Error('В файле не найдено ни одной детали');
    }

    return result;
};
