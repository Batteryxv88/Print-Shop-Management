import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Stock from './Stock';

const partsArray = [
    {
        id: 'part-a',
        part: {
            partName: 'Деталь A',
            partN: 'A-1',
            quantity: 2,
            model: 'Versant',
            section: 'Feed',
            orderQty: 0,
        },
    },
    {
        id: 'part-b',
        part: {
            partName: 'Деталь B',
            partN: 'B-1',
            quantity: 1,
            model: 'Versant',
            section: 'Feed',
            orderQty: 0,
        },
    },
];

vi.mock('../../../shared/assets/icons/clear-order.svg', () => ({
    default: () => null,
}));

vi.mock('../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel', () => ({
    default: () => null,
}));

vi.mock('../../../shared/lib/hooks/useInfiniteList', () => ({
    useInfiniteList: (items: unknown[]) => ({
        visibleItems: items,
        sentinelRef: { current: null },
        hasMore: false,
        total: items.length,
        visibleCount: items.length,
    }),
}));

vi.mock('../../../app/providers/StoreProvider/Store/hooks', () => ({
    useAppDispatch: () =>
        vi.fn(() => ({
            unwrap: () => Promise.resolve(),
        })),
    useAppSelector: (
        selector: (state: {
            machines: { storageModel: string };
        }) => unknown
    ) => selector({ machines: { storageModel: 'Versant' } }),
    useParts: () => ({ partsArray }),
    usePrinters: () => {},
}));

vi.mock('./StockPartRow', () => ({
    default: ({
        id,
        expanded,
        onToggle,
    }: {
        id: string;
        expanded: boolean;
        onToggle: (id: string) => void;
    }) => (
        <button
            type="button"
            data-testid={`row-${id}`}
            data-expanded={expanded ? 'true' : 'false'}
            onClick={() => onToggle(id)}
        >
            {id}
        </button>
    ),
}));

describe('Stock FIFO accordion', () => {
    it('keeps only one expanded row', async () => {
        const user = userEvent.setup();
        render(<Stock />);

        await user.click(screen.getByTestId('row-part-a'));
        expect(screen.getByTestId('row-part-a')).toHaveAttribute(
            'data-expanded',
            'true'
        );
        expect(screen.getByTestId('row-part-b')).toHaveAttribute(
            'data-expanded',
            'false'
        );

        await user.click(screen.getByTestId('row-part-b'));
        expect(screen.getByTestId('row-part-a')).toHaveAttribute(
            'data-expanded',
            'false'
        );
        expect(screen.getByTestId('row-part-b')).toHaveAttribute(
            'data-expanded',
            'true'
        );
    });

    it('collapses row on second click', async () => {
        const user = userEvent.setup();
        render(<Stock />);

        await user.click(screen.getByTestId('row-part-a'));
        await user.click(screen.getByTestId('row-part-a'));

        expect(screen.getByTestId('row-part-a')).toHaveAttribute(
            'data-expanded',
            'false'
        );
    });

    it('collapses expanded row when search changes', async () => {
        const user = userEvent.setup();
        render(<Stock />);

        await user.click(screen.getByTestId('row-part-a'));
        expect(screen.getByTestId('row-part-a')).toHaveAttribute(
            'data-expanded',
            'true'
        );

        await user.type(
            screen.getByPlaceholderText('Артикул или название…'),
            'a'
        );

        expect(screen.getByTestId('row-part-a')).toHaveAttribute(
            'data-expanded',
            'false'
        );
    });
});
