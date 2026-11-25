import { describe, expect, it } from 'vitest';
import {
    collapseResourceRows,
    warehouseNameFor,
} from './collapsePartNames';
import type { ResourcePartRow } from './parsePartsExcel';

const row = (
    partName: string,
    partN: string,
    installedQty = 1,
    spoof = ''
): ResourcePartRow => ({
    section: 'External section',
    partName,
    partN,
    partLife: '64K',
    installedQty,
    ...(spoof ? { spoof } : {}),
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

    it('keeps a spoof row out of the shared card', () => {
        const groups = collapseResourceRows([
            row('Fusing Bearing/Lw', '26NA53712', 2),
            row('Bearing', '26NA53712', 2),
            row('BALL BEARING', '26NA53712', 2, 'FB spoof'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            partN: '26NA53712',
            partName: 'Fusing Bearing/Lw',
            names: ['Fusing Bearing/Lw', 'Bearing'],
            installedQty: 4,
        });
        expect(groups[0].assemblyLines).toEqual([
            expect.objectContaining({
                partName: 'BALL BEARING',
                needQty: 2,
                code: 'FB',
                role: 'spoof',
            }),
        ]);
    });

    it('keeps a unique main or spoof article as its own card', () => {
        const groups = collapseResourceRows([
            row('Fusing belt assy', 'A9VER70422', 1, 'FB main'),
            row('Fusing Roller /1', 'A9VE720300', 1, 'CHAR spoof'),
        ]);
        expect(groups[0]).toMatchObject({
            partN: 'A9VER70422',
            partName: 'Fusing belt assy',
            names: ['Fusing belt assy'],
            installedQty: 1,
            assemblyCode: 'FB',
            assemblyRole: 'main',
        });
        expect(groups[0].assemblyLines).toBeUndefined();
        expect(groups[1]).toMatchObject({
            partName: 'Fusing Roller /1',
            assemblyCode: 'CHAR',
            assemblyRole: 'spoof',
        });
    });
});
