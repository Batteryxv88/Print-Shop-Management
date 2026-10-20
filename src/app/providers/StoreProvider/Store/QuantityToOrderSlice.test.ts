import { describe, expect, it } from 'vitest';

import reducer, {
    fetchQuantityToOrder,
    setOrders,
    updateOrderQty,
    updateOrderQtyAndUseFlag,
    updateOrderUseFlag,
} from './QuantityToOrderSlice';

const sampleOrders = [
    {
        id: 'o1',
        PartN: 'P-1',
        PartName: 'Roller',
        qty: 2,
        use: true,
    },
];

describe('QuantityToOrderSlice', () => {
    it('setOrders replaces list', () => {
        const state = reducer(undefined, setOrders(sampleOrders));
        expect(state.orders).toEqual(sampleOrders);
    });

    it('updateOrderQty patches matching order', () => {
        const initial = reducer(undefined, setOrders(sampleOrders));
        const state = reducer(
            initial,
            updateOrderQty({ id: 'o1', qty: 5 })
        );
        expect(state.orders[0].qty).toBe(5);
    });

    it('updateOrderUseFlag patches use flag', () => {
        const initial = reducer(undefined, setOrders(sampleOrders));
        const state = reducer(
            initial,
            updateOrderUseFlag({ id: 'o1', use: false })
        );
        expect(state.orders[0].use).toBe(false);
    });

    it('updateOrderQtyAndUseFlag patches both fields', () => {
        const initial = reducer(undefined, setOrders(sampleOrders));
        const state = reducer(
            initial,
            updateOrderQtyAndUseFlag({ id: 'o1', qty: 0, use: false })
        );
        expect(state.orders[0]).toMatchObject({ qty: 0, use: false });
    });

    it('fetchQuantityToOrder.fulfilled stores payload and clears loading', () => {
        const pending = reducer(undefined, fetchQuantityToOrder.pending('', undefined));
        expect(pending.isLoading).toBe(true);

        const fulfilled = reducer(
            pending,
            fetchQuantityToOrder.fulfilled(sampleOrders, '', undefined)
        );
        expect(fulfilled.isLoading).toBe(false);
        expect(fulfilled.orders).toEqual(sampleOrders);
    });
});
