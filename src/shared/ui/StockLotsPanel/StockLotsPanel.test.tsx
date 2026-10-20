import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StockLot } from '../../../services/stockAccounting';
import StockLotsPanel from './StockLotsPanel';

vi.mock('./PriceDriftModal', () => ({
    default: () => null,
}));

const loadOpenLotsForStock = vi.fn();

vi.mock('../../../services/stockAccounting', () => ({
    loadOpenLotsForStock: (...args: unknown[]) => loadOpenLotsForStock(...args),
}));

const makeLot = (overrides: Partial<StockLot> = {}): StockLot => ({
    id: 'lot-1',
    type: 'part',
    stockId: 'stock-1',
    costCategory: 'consumable',
    qtyInitial: 10,
    qtyLeft: 5,
    unitPrice: 120,
    currency: 'RUB',
    purchasedAt: '2024-06-01T12:00:00.000Z',
    createdAt: '2024-06-01T12:00:00.000Z',
    supplier: 'Поставщик А',
    ...overrides,
});

describe('StockLotsPanel', () => {
    beforeEach(() => {
        loadOpenLotsForStock.mockReset();
    });

    it('shows loading state until lots arrive', () => {
        loadOpenLotsForStock.mockImplementation(() => () => {});

        render(<StockLotsPanel stockId="stock-1" cardQty={5} />);

        expect(screen.getByText(/Подгрузка партий/)).toBeInTheDocument();
        expect(screen.getByText(/Партии \(FIFO\)/)).toBeInTheDocument();
    });

    it('shows empty state when there are no open lots', async () => {
        loadOpenLotsForStock.mockImplementation((_id, callbacks) => {
            callbacks.onData([], { fromCache: false });
            return () => {};
        });

        render(<StockLotsPanel stockId="stock-1" cardQty={0} />);

        await waitFor(() => {
            expect(
                screen.getByText(/Нет открытых партий/)
            ).toBeInTheDocument();
        });
    });

    it('renders FIFO table and summary for open lots', async () => {
        loadOpenLotsForStock.mockImplementation((_id, callbacks) => {
            callbacks.onData([makeLot()], { fromCache: false });
            return () => {};
        });

        render(<StockLotsPanel stockId="stock-1" cardQty={5} />);

        await waitFor(() => {
            expect(screen.getByText(/След\. списание/)).toBeInTheDocument();
        });

        expect(screen.getByText(/Поставщик А/)).toBeInTheDocument();
        expect(screen.getByText(/5 \/ 10/)).toBeInTheDocument();
        expect(screen.getByText(/Остаток по партиям:/)).toBeInTheDocument();
    });

    it('shows error when load fails without cache', async () => {
        loadOpenLotsForStock.mockImplementation((_id, callbacks) => {
            callbacks.onError('Сеть недоступна');
            return () => {};
        });

        render(<StockLotsPanel stockId="stock-1" cardQty={0} />);

        await waitFor(() => {
            expect(screen.getByText('Сеть недоступна')).toBeInTheDocument();
        });
    });

    it('shows fifo note while loading', () => {
        loadOpenLotsForStock.mockImplementation(() => () => {});

        render(<StockLotsPanel stockId="stock-1" cardQty={5} />);

        expect(
            screen.getByText(/Следующее списание возьмёт товар/)
        ).toBeInTheDocument();
    });

    it('shows mismatch warning when lot sum differs from card qty', async () => {
        loadOpenLotsForStock.mockImplementation((_id, callbacks) => {
            callbacks.onData([makeLot({ qtyLeft: 3 })], { fromCache: false });
            return () => {};
        });

        render(<StockLotsPanel stockId="stock-1" cardQty={10} />);

        await waitFor(() => {
            expect(
                screen.getByText(/не совпадает с остатком на карточке/)
            ).toBeInTheDocument();
        });
    });

    it('calls loadOpenLotsForStock with stock id', () => {
        loadOpenLotsForStock.mockImplementation((_id, callbacks) => {
            callbacks.onData([], { fromCache: false });
            return () => {};
        });

        render(<StockLotsPanel stockId="part-xyz" cardQty={1} />);

        expect(loadOpenLotsForStock).toHaveBeenCalledWith(
            'part-xyz',
            expect.objectContaining({
                onData: expect.any(Function),
                onError: expect.any(Function),
            })
        );
    });
});
