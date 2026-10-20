import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mockMatchMedia } from '../../../test/viewports';
import { maxWidthQuery } from '../breakpoints';
import { useIsMobile } from './useBreakpoint';
import { useMediaQuery as useMediaQueryBase } from './useMediaQuery';

describe('useMediaQuery', () => {
    let restore: (() => void) | undefined;

    afterEach(() => {
        restore?.();
        restore = undefined;
    });

    it('returns true when viewport matches max-width query', async () => {
        restore = mockMatchMedia({ width: 360 });
        const { result } = renderHook(() =>
            useMediaQueryBase(maxWidthQuery('sm'))
        );

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
    });

    it('returns false when viewport is wider than sm', async () => {
        restore = mockMatchMedia({ width: 1280 });
        const { result } = renderHook(() => useIsMobile());

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });
});
