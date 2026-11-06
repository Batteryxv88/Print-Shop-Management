import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { parseKnivesExcel } from './parseKnivesExcel';

const workbookBuffer = (sheets: Record<string, unknown[][]>): ArrayBuffer => {
    const workbook = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    }
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

const knivesHeader = [
    ['Размеры', '', 'Ручьи', 'Повторы', 'Размер к ручью', 'Метка', 'Форма', 'Комментарий', 'Высота без 1 мм', 'Материал', 'Номер Формы/Заказа'],
    ['высота', 'длина', '', '', '', '', '', '', '', '', 'ЗАКАЗ'],
];

describe('parseKnivesExcel', () => {
    it('reads the knives sheet and ignores an orders sheet', () => {
        const buffer = workbookBuffer({
            АЛЕКСЕЙ: [
                ['Номер заказа', 'размер', 'материал'],
                ['1341', '145х193', 'Бумага 2000'],
            ],
            'ножи для ПРОИЗВОДСТВА': [
                ...knivesHeader,
                ['12', '25', '8', '8', '12', 'метка 5х5 с обеих сторон', 'прямоугольник', 'УАЙ СИ', '231', 'плёнка', '61526/81095'],
                ['30', '20', '8', '8', '30', 'метка 5х5 справа', 'фигурная (РЫБКА 1797Т)', '', '184', 'бумага', '27229'],
                ['35', '19', '8', '8', '35', 'метки 4х4 с обеих сторон', 'прямоуголник', 'кругление 2', '183', 'пленка', ''],
                ['31', '27', '4', '8', '31', 'метка 3х3 справа', 'прямоугольник/1/2 штампа', 'ВНИМАНИЕ', '247', 'пленка', '73623'],
            ],
        });

        const { forms, errors } = parseKnivesExcel(buffer);

        expect(errors).toEqual([]);
        expect(forms).toHaveLength(4);
        expect(forms[0]).toMatchObject({
            height: 12,
            width: 25,
            columns: 8,
            rows: 8,
            size_for_column: 12,
            mark: '5х5 L R',
            shape: 'прямоугольник',
            comment: 'УАЙ СИ',
            height_without1: 231,
            material: 'пленка',
            number: '61526/81095',
        });
        expect(forms[1]).toMatchObject({
            mark: '5х5 R',
            shape: 'фигурная',
            comment: '(РЫБКА 1797Т)',
            material: 'бумага',
            number: '27229',
        });
        expect(forms[2]).toMatchObject({
            mark: '4х4 L R',
            shape: 'прямоугольник',
            comment: 'кругление 2',
            material: 'пленка',
            number: '',
        });
        expect(forms[3]).toMatchObject({
            mark: '3х3 R',
            shape: 'прямоугольник',
            comment: 'ВНИМАНИЕ /1/2 штампа',
        });
    });

    it('skips a row without size and keeps the valid ones', () => {
        const buffer = workbookBuffer({
            ножи: [
                ...knivesHeader,
                ['', '25', '8', '8', '12', 'метка 5х5 с обеих сторон', 'круг', '', '100', 'бумага', '1'],
                ['14', '45', '12', '7', '14', 'метка 5х5 с обеих сторон', 'овал', '', '342', 'бумага', '2'],
            ],
        });

        const { forms, errors } = parseKnivesExcel(buffer);

        expect(forms).toHaveLength(1);
        expect(forms[0]).toMatchObject({ height: 14, width: 45, shape: 'овал', number: '2' });
        expect(errors).toEqual([
            { row: 3, message: 'Строка 3: нет высоты или длины' },
        ]);
    });

    it('throws when the workbook has no knives sheet', () => {
        const buffer = workbookBuffer({
            АЛЕКСЕЙ: [['Номер заказа'], ['1341']],
        });

        expect(() => parseKnivesExcel(buffer)).toThrow(/нет листа с формами/);
    });
});
