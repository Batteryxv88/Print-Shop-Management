import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseStock from './PurchaseStock';

const purchaseStock = vi.fn();
const fetchKnownSuppliers = vi.fn();
const fetchLastSupplierForStock = vi.fn();

vi.mock('../../../services/stockAccounting', () => ({
    purchaseStock: (...args: unknown[]) => purchaseStock(...args),
    fetchKnownSuppliers: (...args: unknown[]) => fetchKnownSuppliers(...args),
    fetchLastSupplierForStock: (...args: unknown[]) =>
        fetchLastSupplierForStock(...args),
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ userData: { displayName: 'Buyer' } }),
}));

const partsArray = [
    {
        id: 'part-1',
        part: {
            partN: 'ABC123',
            partName: 'Pressure roller',
            quantity: 2,
            model: 'Versant',
            section: 'Feed',
            costCategory: 'consumable',
        },
    },
];

vi.mock('../../../app/providers/StoreProvider/Store/hooks', () => ({
    useAppDispatch: () =>
        vi.fn(() => ({
            unwrap: () => Promise.resolve({ id: 'new-id' }),
        })),
    useAppSelector: (
        selector: (state: { machines: { storageModel: string } }) => unknown
    ) => selector({ machines: { storageModel: 'Versant' } }),
    useParts: () => ({ partsArray }),
    useToners: () => ({ tonersArr: [] }),
    usePrinters: () => ({ printers: [] }),
}));

describe('PurchaseStock (parts)', () => {
    beforeEach(() => {
        purchaseStock.mockReset();
        fetchKnownSuppliers.mockReset();
        fetchLastSupplierForStock.mockReset();
        purchaseStock.mockResolvedValue({ lotId: 'l1', movementId: 'm1' });
        fetchKnownSuppliers.mockResolvedValue([]);
        fetchLastSupplierForStock.mockResolvedValue('');
    });

    it('disables submit until a part is selected', async () => {
        const user = userEvent.setup();
        render(<PurchaseStock type="part" />);

        await user.click(screen.getByRole('button', { name: 'Приход' }));

        expect(
            screen.getByRole('button', { name: 'Оформить' })
        ).toBeDisabled();
        expect(purchaseStock).not.toHaveBeenCalled();
    });

    it('submits purchase for selected part', async () => {
        const user = userEvent.setup();
        render(<PurchaseStock type="part" />);

        await user.click(screen.getByRole('button', { name: 'Приход' }));

        await user.type(
            screen.getByPlaceholderText('Артикул или название'),
            'ABC123'
        );

        const priceInput = screen.getByPlaceholderText('0');
        await user.type(priceInput, '150');

        await user.click(screen.getByRole('button', { name: 'Оформить' }));

        await waitFor(() => {
            expect(purchaseStock).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'part',
                    stockId: 'part-1',
                    partN: 'ABC123',
                    qty: 1,
                    unitPrice: 150,
                    createdBy: 'Buyer',
                })
            );
        });
    });
});
