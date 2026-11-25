import { describe, expect, it } from 'vitest';
import {
    collapseResourceRows,
    warehouseNameFor,
} from './collapsePartNames';
import type { ResourcePartRow } from './parsePartsExcel';

const row = (
    partName: string,
    partN: string,
    installedQty = 1
): ResourcePartRow => ({
    section: 'External section',
    partName,
    partN,
    partLife: '64K',
    installedQty,
});

describe('warehouseNameFor', () => {
    it('drops a shared color suffix', () => {
        expect(
            warehouseNameFor([
                'Charging corona/Y',
                'Charging corona/M',
                'Charging corona/C',
                'Charging corona/K',
            ])
        ).toBe('Charging corona');
        expect(warehouseNameFor(['Drum unit C', 'drum unit K'])).toBe(
            'Drum unit'
        );
        expect(warehouseNameFor(['Corona \\Y', 'Corona \\M'])).toBe('Corona');
    });

    it('keeps the first name when the leftovers differ', () => {
        expect(warehouseNameFor(['bearing c', 'BearingBall'])).toBe(
            'bearing c'
        );
    });
});

describe('collapseResourceRows', () => {
    it('groups one article and sums installed places', () => {
        const groups = collapseResourceRows([
            row('Charging corona/Y', 'A50UR70323'),
            row('Charging corona/C', 'A50UR70323'),
            row('Filter', 'A50U172200'),
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({
            partN: 'A50UR70323',
            partName: 'Charging corona',
            names: ['Charging corona/Y', 'Charging corona/C'],
            installedQty: 2,
        });
        expect(groups[1].names).toEqual(['Filter']);
    });
});
