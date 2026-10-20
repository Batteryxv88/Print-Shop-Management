import {
    BREAKPOINT_MAX,
    type BreakpointMaxKey,
    maxWidthQuery,
    minWidthQuery,
} from '../breakpoints';
import { useMediaQuery } from './useMediaQuery';

export { BREAKPOINT_MAX, maxWidthQuery, minWidthQuery };

/** Viewport at most breakpoint max (e.g. isDown('sm') === width ≤768). */
export function useIsDown(breakpoint: BreakpointMaxKey, defaultValue = false): boolean {
    return useMediaQuery(maxWidthQuery(breakpoint), defaultValue);
}

/** Shorthand aliases for layout phases. */
export function useIsMobile(defaultValue = false): boolean {
    return useIsDown('sm', defaultValue);
}

export function useIsTabletOnly(defaultValue = false): boolean {
    const downMd = useIsDown('md', defaultValue);
    const downSm = useIsDown('sm', defaultValue);
    return downMd && !downSm;
}

export function useIsDesktop(defaultValue = true): boolean {
    return useMediaQuery(minWidthQuery('md'), defaultValue);
}
