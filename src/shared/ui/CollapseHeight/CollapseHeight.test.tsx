import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CollapseHeight from './CollapseHeight';

describe('CollapseHeight', () => {
    it('shows content when open and sets aria-hidden false', () => {
        const { container } = render(
            <CollapseHeight open className="extra">
                <p data-testid="open-child">Внутри</p>
            </CollapseHeight>
        );

        const root = container.firstElementChild as HTMLElement;

        expect(screen.getByTestId('open-child')).toBeInTheDocument();
        expect(root).toHaveClass('extra');
        expect(root).toHaveAttribute('aria-hidden', 'false');
    });

    it('collapses when closed', () => {
        const { container } = render(
            <CollapseHeight open={false}>
                <p data-testid="closed-child">Скрыто</p>
            </CollapseHeight>
        );

        const root = container.firstElementChild as HTMLElement;

        expect(root).toHaveAttribute('aria-hidden', 'true');
        expect(root.style.maxHeight).toBe('0px');
    });

    it('applies open state class when expanded', () => {
        const { container } = render(
            <CollapseHeight open>
                <p>OK</p>
            </CollapseHeight>
        );

        expect(container.firstElementChild?.className).toMatch(/open/);
    });
});
