import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StockLot } from './stockAccounting';

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'lots-collection'),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    writeBatch: vi.fn(),
    updateDoc: vi.fn(),
    runTransaction: vi.fn(),
    increment: vi.fn(),
    onSnapshot: vi.fn(),
}));

vi.mock('./firebase', () => ({ db: {} }));

const {
    fetchLotsByStockId,
    fetchPriceDriftAllForStock,
    invalidateStockLotsCache,
    loadOpenLotsForStock,
} = await import('./stockAccounting');

const lotFields = (
    overrides: Partial<Omit<StockLot, 'id'>> = {}
): Omit<StockLot, 'id'> => ({
    type: 'part',
    stockId: 'stock-a',
    costCategory: 'consumable',
    qtyInitial: 10,
    qtyLeft: 5,
    unitPrice: 100,
    currency: 'RUB',
    purchasedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
});

const mockSnapshot = (
    rows: Array<{ id: string; data: Omit<StockLot, 'id'> }>
) => ({
    docs: rows.map(({ id, data }) => ({
        id,
        data: () => data,
    })),
});

describe('fetchLotsByStockId', () => {
    beforeEach(() => {
        mockGetDocs.mockReset();
        invalidateStockLotsCache();
    });

    it('filters closed lots when openOnly is true and sorts FIFO', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([
                {
                    id: 'new',
                    data: lotFields({
                        purchasedAt: '2024-06-01T00:00:00.000Z',
                        qtyLeft: 3,
                    }),
                },
                {
                    id: 'old',
                    data: lotFields({
                        purchasedAt: '2024-01-01T00:00:00.000Z',
                        qtyLeft: 2,
                    }),
                },
                {
                    id: 'closed',
                    data: lotFields({ qtyLeft: 0 }),
                },
            ])
        );

        const lots = await fetchLotsByStockId('stock-a', true);

        expect(lots.map((l) => l.id)).toEqual(['old', 'new']);
        expect(lots).toHaveLength(2);
    });
});

describe('loadOpenLotsForStock', () => {
    beforeEach(() => {
        mockGetDocs.mockReset();
        invalidateStockLotsCache();
    });

    it('calls onData with fresh data when cache is empty', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields() }])
        );

        const onData = vi.fn();
        const onError = vi.fn();

        loadOpenLotsForStock('stock-a', { onData, onError });

        await vi.waitFor(() => expect(onData).toHaveBeenCalledTimes(1));

        expect(onData).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'l1' })],
            { fromCache: false }
        );
        expect(onError).not.toHaveBeenCalled();
    });

    it('serves cache first then revalidates', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields({ qtyLeft: 4 }) }])
        );

        const first = vi.fn();
        loadOpenLotsForStock('stock-a', {
            onData: first,
            onError: vi.fn(),
        });
        await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1));

        mockGetDocs.mockResolvedValue(
            mockSnapshot([
                { id: 'l1', data: lotFields({ qtyLeft: 2 }) },
            ])
        );

        const second = vi.fn();
        loadOpenLotsForStock('stock-a', {
            onData: second,
            onError: vi.fn(),
        });

        expect(second).toHaveBeenNthCalledWith(
            1,
            [expect.objectContaining({ id: 'l1', qtyLeft: 4 })],
            { fromCache: true }
        );

        await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(2));

        expect(second).toHaveBeenNthCalledWith(
            2,
            [expect.objectContaining({ id: 'l1', qtyLeft: 2 })],
            { fromCache: false }
        );
    });

    it('calls onError when fetch fails and there is no cache', async () => {
        mockGetDocs.mockRejectedValue(new Error('offline'));

        const onError = vi.fn();
        loadOpenLotsForStock('stock-a', { onData: vi.fn(), onError });

        await vi.waitFor(() =>
            expect(onError).toHaveBeenCalledWith('offline')
        );
    });

    it('keeps cached UI on fetch error', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields() }])
        );

        const onDataWarm = vi.fn();
        loadOpenLotsForStock('stock-a', {
            onData: onDataWarm,
            onError: vi.fn(),
        });
        await vi.waitFor(() => expect(onDataWarm).toHaveBeenCalledTimes(1));

        mockGetDocs.mockRejectedValue(new Error('offline'));

        const onError = vi.fn();
        loadOpenLotsForStock('stock-a', {
            onData: vi.fn(),
            onError,
        });

        await new Promise((r) => setTimeout(r, 20));
        expect(onError).not.toHaveBeenCalled();
    });

    it('cancel prevents callbacks after unmount', async () => {
        let resolveDocs: (value: unknown) => void = () => {};
        mockGetDocs.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDocs = resolve;
                })
        );

        const onData = vi.fn();
        const cancel = loadOpenLotsForStock('stock-a', {
            onData,
            onError: vi.fn(),
        });

        cancel();
        resolveDocs(mockSnapshot([{ id: 'l1', data: lotFields() }]));

        await new Promise((r) => setTimeout(r, 20));
        expect(onData).not.toHaveBeenCalled();
    });
});

describe('invalidateStockLotsCache', () => {
    beforeEach(() => {
        mockGetDocs.mockReset();
        invalidateStockLotsCache();
    });

    it('clears open lots cache so next load refetches', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields({ qtyLeft: 9 }) }])
        );

        const onData = vi.fn();
        loadOpenLotsForStock('stock-a', { onData, onError: vi.fn() });
        await vi.waitFor(() => expect(onData).toHaveBeenCalledTimes(1));

        invalidateStockLotsCache('stock-a');

        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields({ qtyLeft: 1 }) }])
        );

        const onData2 = vi.fn();
        loadOpenLotsForStock('stock-a', { onData: onData2, onError: vi.fn() });

        await vi.waitFor(() => expect(onData2).toHaveBeenCalledTimes(1));

        expect(onData2).toHaveBeenCalledWith(
            [expect.objectContaining({ qtyLeft: 1 })],
            { fromCache: false }
        );
    });

    it('clears price drift cache for stock id', async () => {
        mockGetDocs.mockResolvedValue(
            mockSnapshot([{ id: 'l1', data: lotFields() }])
        );

        await fetchPriceDriftAllForStock('stock-a');
        await fetchPriceDriftAllForStock('stock-a');
        expect(mockGetDocs).toHaveBeenCalledTimes(1);

        invalidateStockLotsCache('stock-a');

        await fetchPriceDriftAllForStock('stock-a');
        expect(mockGetDocs).toHaveBeenCalledTimes(2);
    });
});
