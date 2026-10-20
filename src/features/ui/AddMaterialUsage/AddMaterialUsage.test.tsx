import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddMaterialUsage from './AddMaterialUsage';

const writeOffFifo = vi.fn();
const addMaterialUsage = vi.fn();

vi.mock('../../../services/stockAccounting', () => ({
    writeOffFifo: (...args: unknown[]) => writeOffFifo(...args),
}));

vi.mock('../../../services/materialUsage', () => ({
    addMaterialUsage: (...args: unknown[]) => addMaterialUsage(...args),
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ userData: { displayName: 'Tester' } }),
}));

vi.mock('../../../app/providers/StoreProvider/Store/hooks', () => ({
    useMaterials: () => ({
        materials: [
            {
                id: 'm1',
                name: 'SRA3',
                type: 'paper',
                qty: 10,
                status: 'ok',
            },
        ],
    }),
    useLaminations: () => ({ laminations: [] }),
}));

vi.mock('../../../shared/ui/NotificationModal/NotificationModal', () => ({
    default: ({
        isOpen,
        message,
    }: {
        isOpen: boolean;
        message: string;
    }) => (isOpen ? <div role="alert">{message}</div> : null),
}));

vi.mock('../../../shared/ui/FifoBreakdownModal/FifoBreakdownModal', () => ({
    default: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
        isOpen ? <div data-testid="fifo-modal">{title}</div> : null,
}));

describe('AddMaterialUsage', () => {
    beforeEach(() => {
        writeOffFifo.mockReset();
        addMaterialUsage.mockReset();
        writeOffFifo.mockResolvedValue({
            movementId: 'mov-1',
            totalCost: 500,
            unitPriceAvg: 50,
            lots: [{ lotId: 'l1', qty: 1, unitPrice: 50, cost: 50 }],
        });
        addMaterialUsage.mockResolvedValue(undefined);
    });

    it('shows validation when position not selected', async () => {
        const user = userEvent.setup();
        render(<AddMaterialUsage kind="paper" />);

        await user.click(screen.getByRole('button', { name: 'Списать' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Выберите позицию');
        expect(writeOffFifo).not.toHaveBeenCalled();
    });

    it('calls writeOffFifo and addMaterialUsage on successful submit', async () => {
        const user = userEvent.setup();
        render(<AddMaterialUsage kind="paper" />);

        await user.selectOptions(screen.getByRole('combobox'), 'm1');
        await user.clear(screen.getByLabelText('Количество'));
        await user.type(screen.getByLabelText('Количество'), '2');
        await user.click(screen.getByRole('button', { name: 'Списать' }));

        await waitFor(() => {
            expect(writeOffFifo).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'paper',
                    stockId: 'm1',
                    qty: 2,
                    man: 'Tester',
                    costCategory: 'paper',
                })
            );
        });

        expect(addMaterialUsage).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'paper',
                stockId: 'm1',
                qty: 2,
                movementId: 'mov-1',
            })
        );

        expect(screen.getByTestId('fifo-modal')).toHaveTextContent(
            'Списание бумаги (FIFO)'
        );
    });

    it('rejects qty greater than stock', async () => {
        const user = userEvent.setup();
        render(<AddMaterialUsage kind="paper" />);

        await user.selectOptions(screen.getByRole('combobox'), 'm1');
        await user.clear(screen.getByLabelText('Количество'));
        await user.type(screen.getByLabelText('Количество'), '99');
        await user.click(screen.getByRole('button', { name: 'Списать' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Недостаточно на складе'
        );
        expect(writeOffFifo).not.toHaveBeenCalled();
    });
});
