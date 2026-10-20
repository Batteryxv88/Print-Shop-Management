import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PartPicker, { type PartPickerOption } from './PartPicker';

const options: PartPickerOption[] = [
    {
        id: '1',
        partN: 'ABC-100',
        partName: 'Roller',
        section: 'Feed',
        qty: 3,
    },
    {
        id: '2',
        partN: 'XYZ-9',
        partName: 'Belt',
        section: 'Other',
        qty: 0,
    },
];

describe('PartPicker', () => {
    it('filters list by part number or name', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();

        render(
            <PartPicker
                query=""
                onQueryChange={onQueryChange}
                options={options}
                selectedId={null}
                onSelect={vi.fn()}
            />
        );

        await user.click(
            screen.getByRole('button', { name: 'Показать весь список' })
        );

        expect(screen.getByText('Roller')).toBeInTheDocument();
        expect(screen.getByText('Belt')).toBeInTheDocument();

        await user.type(
            screen.getByPlaceholderText('Артикул или название'),
            'xyz'
        );

        expect(onQueryChange).toHaveBeenCalled();
    });

    it('calls onSelect when option clicked', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        render(
            <PartPicker
                query="abc"
                onQueryChange={vi.fn()}
                options={options}
                selectedId={null}
                onSelect={onSelect}
            />
        );

        await user.click(screen.getByPlaceholderText('Артикул или название'));
        await user.click(screen.getByText('Roller'));

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ id: '1', partN: 'ABC-100' })
        );
    });

    it('selects highlighted row on Enter', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        render(
            <PartPicker
                query=""
                onQueryChange={vi.fn()}
                options={options}
                selectedId={null}
                onSelect={onSelect}
            />
        );

        const input = screen.getByPlaceholderText('Артикул или название');
        await user.click(
            screen.getByRole('button', { name: 'Показать весь список' })
        );
        await user.click(input);
        await user.keyboard('{Enter}');

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ id: '1' })
        );
    });
});
