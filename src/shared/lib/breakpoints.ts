/** Pixel max-widths; align with `src/app/styles/breakpoints/_breakpoints.scss`. */
export const BREAKPOINT_MAX = {
    xs: 480,
    sm: 768,
    md: 1024,
} as const;

export type BreakpointMaxKey = keyof typeof BREAKPOINT_MAX;

/** Viewports used in E2E and RTL helpers. */
export const VIEWPORT_PRESETS = {
    mobile: 375,
    mobileLarge: 390,
    tablet: 768,
    tabletLandscape: 1024,
    desktop: 1280,
} as const;

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

export function maxWidthQuery(breakpoint: BreakpointMaxKey): string {
    return `(max-width: ${BREAKPOINT_MAX[breakpoint]}px)`;
}

export function minWidthQuery(breakpoint: BreakpointMaxKey): string {
    return `(min-width: ${BREAKPOINT_MAX[breakpoint] + 1}px)`;
}

/** True when viewport width is at most the given breakpoint. */
export function isAtMost(width: number, breakpoint: BreakpointMaxKey): boolean {
    return width <= BREAKPOINT_MAX[breakpoint];
}
