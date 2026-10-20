import { describe, expect, it } from 'vitest';

import reducer, { setParts, updateStock } from './PartSlice';

const parts = [
    {
        id: 'p1',
        part: {
            partName: 'Roller',
            partN: 'R-1',
            quantity: 4,
            orderQty: 0,
        },
    },
];

describe('PartSlice', () => {
    it('setParts replaces partsArray', () => {
        const state = reducer(undefined, setParts(parts));
        expect(state.partsArray).toEqual(parts);
    });

    it('updateStock.fulfilled merges part fields', () => {
        const initial = reducer(undefined, setParts(parts));
        const state = reducer(
            initial,
            updateStock.fulfilled(
                { id: 'p1', part: { orderQty: 3, quantity: 4 } },
                '',
                { id: 'p1', part: { orderQty: 3 } }
            )
        );

        expect(state.partsArray[0].part.orderQty).toBe(3);
        expect(state.partsArray[0].part.partName).toBe('Roller');
    });

    it('updateStock.fulfilled ignores unknown id', () => {
        const initial = reducer(undefined, setParts(parts));
        const state = reducer(
            initial,
            updateStock.fulfilled(
                { id: 'missing', part: { orderQty: 9 } },
                '',
                { id: 'missing', part: { orderQty: 9 } }
            )
        );
        expect(state.partsArray[0].part.orderQty).toBe(0);
    });
});
