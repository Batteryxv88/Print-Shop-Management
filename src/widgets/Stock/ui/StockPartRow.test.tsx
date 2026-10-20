import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StockPartRow from './StockPartRow';

vi.mock('../../../shared/ui/Part/Part', () => ({
    default: ({ name }: { name: string }) => (
        <div>
            <span>{name}</span>
            <input type="number" aria-label="К заказу" />
        </div>
    ),
}));

vi.mock('../../../shared/ui/StockLotsPanel/StockLotsPanel', () => ({
    default: ({ stockId }: { stockId: string }) => (
        <div data-testid="lots-panel">{stockId}</div>
    ),
}));

const baseProps = {
    id: 'part-1',
    name: 'Ролик',
    number: 'ABC-1',
    qty: 3,
    expanded: false,
    onToggle: vi.fn(),
};

describe('StockPartRow', () => {
    it('toggles FIFO panel on row click', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();

        render(<StockPartRow {...baseProps} onToggle={onToggle} />);

        await user.click(
            screen.getByRole('button', {
                name: /Показать партии FIFO/,
            })
        );

        expect(onToggle).toHaveBeenCalledWith('part-1');
    });

    it('does not toggle when clicking order input', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();

        render(<StockPartRow {...baseProps} onToggle={onToggle} />);

        await user.click(screen.getByLabelText('К заказу'));

        expect(onToggle).not.toHaveBeenCalled();
    });

    it('toggles on Enter key', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();

        render(<StockPartRow {...baseProps} onToggle={onToggle} />);

        const row = screen.getByRole('button', {
            name: /Показать партии FIFO/,
        });
        row.focus();
        await user.keyboard('{Enter}');

        expect(onToggle).toHaveBeenCalledWith('part-1');
    });

    it('mounts lots panel only when expanded', () => {
        const { rerender } = render(
            <StockPartRow {...baseProps} expanded={false} />
        );

        expect(screen.queryByTestId('lots-panel')).not.toBeInTheDocument();

        rerender(<StockPartRow {...baseProps} expanded />);

        expect(screen.getByTestId('lots-panel')).toHaveTextContent('part-1');
    });
});
