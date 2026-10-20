import { describe, expect, it } from 'vitest';
import {
    BREAKPOINT_MAX,
    isAtMost,
    maxWidthQuery,
    minWidthQuery,
} from './breakpoints';

describe('breakpoints', () => {
    it('exposes max widths aligned with SCSS', () => {
        expect(BREAKPOINT_MAX).toEqual({ xs: 480, sm: 768, md: 1024 });
    });

    it('builds media queries', () => {
        expect(maxWidthQuery('sm')).toBe('(max-width: 768px)');
        expect(minWidthQuery('md')).toBe('(min-width: 1025px)');
    });

    it('isAtMost compares width to tokens', () => {
        expect(isAtMost(375, 'sm')).toBe(true);
        expect(isAtMost(769, 'sm')).toBe(false);
        expect(isAtMost(1024, 'md')).toBe(true);
        expect(isAtMost(1025, 'md')).toBe(false);
    });
});
