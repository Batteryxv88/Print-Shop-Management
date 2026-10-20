import { describe, expect, it } from 'vitest';
import { mockMatchMedia } from './viewports';

describe('mockMatchMedia', () => {
    it('matches max-width queries from viewport width', () => {
        const restore = mockMatchMedia({ width: 400 });
        expect(window.matchMedia('(max-width: 768px)').matches).toBe(true);
        expect(window.matchMedia('(max-width: 480px)').matches).toBe(true);
        expect(window.matchMedia('(min-width: 769px)').matches).toBe(false);
        restore();
    });

    it('matches min-width queries', () => {
        const restore = mockMatchMedia({ width: 1280 });
        expect(window.matchMedia('(min-width: 1025px)').matches).toBe(true);
        expect(window.matchMedia('(max-width: 768px)').matches).toBe(false);
        restore();
    });
});
