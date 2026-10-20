import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseStock from './PurchaseStock';

const purchaseStock = vi.fn();

vi.mock('../../../services/stockAccounting', () => ({
    purchaseStock: (...args: unknown[]) => purchaseStock(...args),
    fetchKnownSuppliers: vi.fn().mockResolvedValue([]),
    fetchLastSupplierForStock: vi.fn().mockResolvedValue(''),
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ userData: { displayName: 'Buyer' } }),
}));

vi.mock('../../../app/providers/StoreProvider/Store/hooks', () => ({
    useAppDispatch: () => vi.fn(),
    useAppSelector: (
        selector: (state: { machines: { storageModel: string } }) => unknown
    ) => selector({ machines: { storageModel: 'Versant' } }),
    useParts: () => ({ partsArray: [] }),
    useToners: () => ({
        tonersArr: [
            {
                id: 't1',
                toner: { color: 'K', model: 'Versant', qty: 2 },
            },
        ],
    }),
    usePrinters: () => ({
        printers: [{ model: 'Versant', colorMode: 'color', colors: ['K'] }],
    }),
}));

describe('PurchaseStock (toners)', () => {
    beforeEach(() => {
        purchaseStock.mockReset();
        purchaseStock.mockResolvedValue({ lotId: 'l1', movementId: 'm1' });
    });

    it('requires at least one toner line with qty', async () => {
        const user = userEvent.setup();
        render(<PurchaseStock type="toner" />);

        await user.click(screen.getByRole('button', { name: 'Приход' }));
        await user.click(screen.getByRole('button', { name: 'Оформить' }));

        expect(
            screen.getByText(/Укажите количество хотя бы для одного цвета/)
        ).toBeInTheDocument();
        expect(purchaseStock).not.toHaveBeenCalled();
    });

    it('submits purchase for filled toner line', async () => {
        const user = userEvent.setup();
        render(<PurchaseStock type="toner" />);

        await user.click(screen.getByRole('button', { name: 'Приход' }));

        const qtyInputs = screen.getAllByRole('spinbutton');
        await user.type(qtyInputs[0], '1');
        await user.type(qtyInputs[1], '500');

        await user.click(screen.getByRole('button', { name: 'Оформить' }));

        await waitFor(() => {
            expect(purchaseStock).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'toner',
                    stockId: 't1',
                    color: 'K',
                    qty: 1,
                    unitPrice: 500,
                })
            );
        });
    });
});
