import { describe, expect, it } from 'vitest';
import type { Printer } from '../../../services/printers';
import type { StockMovement } from '../../../services/stockAccounting';
import {
    filterMovementsForActivePrinters,
    isMovementForActivePrinters,
} from './activePrinterFilter';

const printers: Printer[] = [
    {
        id: 'p1',
        name: 'Alpha',
        model: 'Versant',
        colorMode: 'color',
        colors: ['K'],
    },
    {
        id: 'p2',
        name: 'Beta',
        model: 'Versant',
        colorMode: 'color',
        colors: ['K'],
    },
];

const base = (patch: Partial<StockMovement>): StockMovement =>
    ({
        id: 'm1',
        kind: 'writeoff',
        type: 'part',
        stockId: 's1',
        costCategory: 'consumable',
        qty: 1,
        totalCost: 100,
        unitPriceAvg: 100,
        date: '2025-01-01',
        lots: [],
        ...patch,
    }) as StockMovement;

describe('isMovementForActivePrinters', () => {
    it('accepts movement with active printerId', () => {
        expect(
            isMovementForActivePrinters(
                base({ printerId: 'p1', machine: 'Old' }),
                printers
            )
        ).toBe(true);
    });

    it('rejects movement with unknown printerId', () => {
        expect(
            isMovementForActivePrinters(
                base({ printerId: 'deleted', machine: 'Alpha' }),
                []
            )
        ).toBe(false);
    });

    it('ignores legacy records with only machine name', () => {
        expect(
            isMovementForActivePrinters(base({ machine: 'Alpha' }), printers)
        ).toBe(false);
    });

    it('purchase on model without printerId is excluded', () => {
        expect(
            isMovementForActivePrinters(
                base({
                    kind: 'purchase',
                    type: 'toner',
                    costCategory: 'toner',
                    model: 'Versant',
                }),
                printers
            )
        ).toBe(false);
    });

    it('paper movement excluded from printer analytics stream', () => {
        expect(
            isMovementForActivePrinters(
                base({ type: 'paper', costCategory: 'paper' }),
                []
            )
        ).toBe(false);
    });
});

describe('filterMovementsForActivePrinters', () => {
    it('drops records without printerId', () => {
        const list = filterMovementsForActivePrinters(
            [base({ machine: 'Alpha' })],
            printers
        );
        expect(list).toHaveLength(0);
    });
});
