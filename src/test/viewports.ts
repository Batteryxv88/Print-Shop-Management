import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BREAKPOINT_MAX, VIEWPORT_PRESETS } from '../shared/lib/breakpoints';

export { BREAKPOINT_MAX, VIEWPORT_PRESETS };

type MatchMediaMockOptions = {
    width: number;
    prefersReducedMotion?: boolean;
};

/**
 * Stub `window.matchMedia` for a fixed viewport width (jsdom).
 */
export function mockMatchMedia(options: MatchMediaMockOptions): () => void {
    const { width, prefersReducedMotion = false } = options;
    const original = window.matchMedia;

    window.matchMedia = (query: string) => {
        let matches = false;

        const maxMatch = query.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
        if (maxMatch) {
            matches = width <= Number(maxMatch[1]);
        }

        const minMatch = query.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
        if (minMatch) {
            matches = width >= Number(minMatch[1]);
        }

        if (query.includes('prefers-reduced-motion: reduce')) {
            matches = prefersReducedMotion;
        }

        const listeners = new Set<() => void>();
        const mql = {
            media: query,
            matches,
            onchange: null as ((ev: MediaQueryListEvent) => void) | null,
            addEventListener: (_: string, cb: () => void) => {
                listeners.add(cb);
            },
            removeEventListener: (_: string, cb: () => void) => {
                listeners.delete(cb);
            },
            addListener: (cb: () => void) => listeners.add(cb),
            removeListener: (cb: () => void) => listeners.delete(cb),
            dispatchEvent: () => true,
        };

        return mql as MediaQueryList;
    };

    return () => {
        window.matchMedia = original;
    };
}

export function renderAtWidth(
    ui: ReactElement,
    width: number,
    options?: RenderOptions
) {
    const restore = mockMatchMedia({ width });
    const result = render(ui, options);
    return {
        ...result,
        restoreMatchMedia: restore,
    };
}
