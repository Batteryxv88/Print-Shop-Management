import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePartsExcel } from './parsePartsExcel';

const workbookWithMergedSpoof = (): ArrayBuffer => {
    const rows: (string | number)[][] = [
        ['No.', 'Section', 'PM Parts Name', 'Qty', 'Replace', 'Parts No.', 'Spoof'],
        ['55', 'Fusing section', 'Fusing belt assy', 1, '600K', 'A9VER70422', 'FB main'],
        ['56', '', 'Fusing Roller /1', 1, '600K', 'A9VE720300', 'FB spoof'],
        ['57', '', 'Fusing Roller /3', 1, '600K', 'A9VE720600', ''],
        ['58', '', 'Regulating Sleeve /1', 2, '600K', 'A9VE724100', ''],
        ['59', '', 'Fusing Belt', 1, '600K', 'A50U765000', ''],
        ['60', '', 'Insulating Sleeve /Lower', 2, '600K', 'A50U756300', ''],
        ['61', '', 'Insulating Sleeve /Upper', 2, '600K', 'A9VP744900', ''],
        ['62', '', 'BALL BEARING', 2, '600K', '26NA53712', ''],
        ['63', '', 'Fusing Bearing/1', 2, '600K', 'A5AW745000', ''],
        ['64', '', 'Drive Gear /Upper 38T', 1, '600K', 'A50U725001', ''],
        ['65', '', 'Fusing paper exit roller/Up', 2, '1200K', 'A9VE760900', ''],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!merges'] = [{ s: { r: 2, c: 6 }, e: { r: 10, c: 6 } }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Лист1');
    return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

describe('parsePartsExcel merged Spoof', () => {
    it('copies the mark across the merged range and stops at its edge', () => {
        const parsed = parsePartsExcel(workbookWithMergedSpoof());
        const spoofNames = parsed
            .filter((row) => row.spoof === 'FB spoof')
            .map((row) => row.partName);

        expect(spoofNames).toEqual([
            'Fusing Roller /1',
            'Fusing Roller /3',
            'Regulating Sleeve /1',
            'Fusing Belt',
            'Insulating Sleeve /Lower',
            'Insulating Sleeve /Upper',
            'BALL BEARING',
            'Fusing Bearing/1',
            'Drive Gear /Upper 38T',
        ]);
        expect(parsed.find((row) => row.partName === 'Fusing belt assy')?.spoof).toBe(
            'FB main'
        );
        expect(
            parsed.find((row) => row.partName === 'Fusing paper exit roller/Up')
                ?.spoof
        ).toBeUndefined();
    });
});
