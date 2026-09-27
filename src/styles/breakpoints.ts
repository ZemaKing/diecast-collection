// Single documented source for breakpoints. CSS can't use var() inside @media, so the same
// numbers are written literally in CSS — see the header comment in styles.css.
// `breakpoints.test.ts` fails if the two drift apart.
//
//   mobile  < 640 · tablet 640–1023 · desktop ≥ 1024 · wide ≥ 1600
export const BREAKPOINTS = {
    tablet: 640,
    desktop: 1024,
    wide: 1600,
} as const;

export type Breakpoint = "mobile" | keyof typeof BREAKPOINTS;

// Media-query strings for matchMedia / JS. `.02` avoids a 1px overlap at fractional zoom.
export const MEDIA = {
    mobile: `(max-width: ${BREAKPOINTS.tablet - 0.02}px)`,
    tabletUp: `(min-width: ${BREAKPOINTS.tablet}px)`,
    tabletOnly: `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 0.02}px)`,
    desktopUp: `(min-width: ${BREAKPOINTS.desktop}px)`,
    wideUp: `(min-width: ${BREAKPOINTS.wide}px)`,
} as const;

export function breakpointFor(width: number): Breakpoint {
    if (width >= BREAKPOINTS.wide) return "wide";
    if (width >= BREAKPOINTS.desktop) return "desktop";
    if (width >= BREAKPOINTS.tablet) return "tablet";
    return "mobile";
}
