# Design Tokens

Source of truth: [`src/styles/styles.css`](../src/styles/styles.css). Live reference with every token rendered in the current theme: **`/dev/tokens`** (dev server only; not in production builds).

## Rules

- Components use `var(--token)` only. No hard-coded colors, spacing, radii, font sizes, shadows or durations.
- `src/styles/tokens.test.ts` enforces:
  - every `var(--x)` used in `src` is defined;
  - no new hard-coded colors outside `styles.css`. Existing debt in `Header` is capped and may only go down (`DetailsModal` was deleted in Phase 20, `landing-page` earlier);
  - breakpoints stay in sync with `breakpoints.ts`;
  - every category in the data has a dark and a light color token.
- `src/styles/contrast.test.ts` enforces ≥ 4.5:1 for every text token on every surface, in both themes, and ≥ 3:1 for the non-text cues (focus ring, chart bars, `--state-selected-border`). Accessibility as a whole: `docs/accessibility.md`.
- Prefer **semantic** tokens (`--color-surface`, `--color-text-muted`) over raw values. Legacy names (`--bg`, `--panel`, `--muted`, …) are aliases for pre-redesign components; don't use them in new code. They are removed in Phase 36.

## Token groups

| Group | Tokens | Notes |
| --- | --- | --- |
| Surfaces | `--color-bg`, `-bg-elevated`, `-surface`, `-surface-sunken`, `-surface-raised`, `-surface-hover` | Navy/charcoal, sampled from the mockups. Page → card → dialog → hover/image well |
| Text | `--color-text`, `-text-secondary`, `-text-muted`, `-text-subtle`, `-text-inverse` | `-subtle` is **non-text only** (decoration, disabled). It is < 4.5:1 |
| Borders | `--color-border-subtle`, `--color-border`, `--color-border-strong`, `--border-width(-strong)` | Translucent hairlines |
| Accent | `--color-accent` (+`-hover`, `-active`, `-soft`), `--color-accent-text`, `--color-on-accent` | Gold. Use `-accent` for fills and borders, `-accent-text` for gold text/icons, and `-on-accent` for text on a gold fill |
| Feedback | `--color-success`, `-info`, `-warning`, `-danger` | "Collected" green / "Near Mint" blue from the details mockup |
| States | `--state-hover`, `--state-active`, `--state-selected-bg`, `--state-selected-border`, `--state-disabled-opacity`, `--focus-ring`, `--focus-ring-color` | Hover/active are overlays that work on any surface. A global `:focus-visible` uses `--focus-ring`. **`--state-selected-border` is for every selected/current cue drawn as a line** (nav underline, active tab, active filter, current thumbnail, selected swatch ring): gold in dark, `--color-accent-text` in light, since raw `--color-accent` is 1.6:1 on white (Phase 34) |
| Elevation | `--shadow-sm/md/lg`, `--shadow-color`, `--color-overlay`, `--color-scrim-strong`, `--color-on-scrim(-muted)`, `--color-scrim-control(-hover)` (lightbox — theme-independent, the scrim is black in both) | |
| Category | `--cat-rally`, `-racing`, `-supercar`, `-premium`, `-retro`, `--cat-fallback` | Keyed by **slug** (`categorySlug()` in `src/utils/category.ts`). Truck-only slugs are removed in Phase 11 |
| Typography | `--font-sans`, `--text-2xs … --text-3xl`, `--text-display`, `--weight-*`, `--leading-*`, `--tracking-*` | `--text-display` is fluid (`clamp`) for the hero |
| Spacing | `--space-2xs` (2) … `--space-4xl` (64) | 4px grid. Existing `xs–xl` values unchanged |
| Radius | `--radius-xs` (4) … `--radius-xl` (20), `--radius-pill`, `--radius-round` | |
| Motion | `--duration-instant/fast/base/slow/slower`, `--ease-standard/emphasized/exit` | All durations → `0ms` under `prefers-reduced-motion` |
| Layers | `--z-base`, `--z-sticky`, `--z-dropdown`, `--z-modal`, `--z-lightbox`, `--z-toast` | |
| Layout | `--container-max`, `--container-gutter`, `--header-height`, `--tap-target` (44px), `--target-min` (24px), `--card-min-width` (220px) | `--card-min-width` is the collection grid's `auto-fill` column floor (Phase 17). `--tap-target` is the touch aim, `--target-min` the WCAG 2.2 AA floor for any pointer target (Phase 34) |
| Logos | `--logo-shipped-filter` | `none` in dark, `brightness(0.5)` in light: the 64 shipped brand/manufacturer SVGs are fixed `#A9B1BF` (2:1 on white → ≈ 7:1). Applied in `styles.css` to `img[src^="/brands/"]` and `img[src^="/manufacturers/"]`; uploaded logos are untouched (Phase 34) |
| Hero | `--hero-glow`, `--hero-sheen`, `--hero-art-opacity` | Collection hero backdrop, per theme (Phase 17) |
| Charts | `--chart-bar`, `--chart-track` | Statistics bars/columns/meter fill (one hue, ≥ 3:1 on every surface — tested) and the meter's unfilled track (Phase 23) |

## Breakpoints

| Name | Range | CSS | JS (`src/styles/breakpoints.ts`) |
| --- | --- | --- | --- |
| mobile | < 640px | `@media (max-width: 639.98px)` | `MEDIA.mobile` |
| tablet | 640–1023px | `@media (min-width: 640px)` | `MEDIA.tabletUp` / `MEDIA.tabletOnly` |
| desktop | ≥ 1024px | `@media (min-width: 1024px)` | `MEDIA.desktopUp` |
| wide | ≥ 1600px | `@media (min-width: 1600px)` | `MEDIA.wideUp` |

CSS can't use `var()` inside `@media`, so the numbers are written literally. Write media queries min-width first (mobile-up).

Some pre-redesign files still use other widths: 1280/1500/1800 in the grid and card, 768 on the landing page (and 600 in `DetailsModal`, deleted in Phase 20). Changing them now would move the current layout, so they are converted when those components are rebuilt (Phases 16–17, 20, 11).

## Decisions

### Typography: Nunito Sans replaces Jost
The mockups use a humanist-geometric sans. It has a double-story `a`, a straight-sided `M` and wide proportions, and reads as Avenir Next Demi. Jost is Futura-style: narrower, with a splayed `M`. Side by side against the mockup hero, Nunito Sans was the closest free match (Figtree was the runner-up, rounder). It loads as a variable font with `display: swap` — **self-hosted since Phase 33** (`@fontsource-variable/nunito-sans`, imported in `main.tsx`, family `"Nunito Sans Variable"`; not preloaded — see `docs/performance.md`). It was Google Fonts with the `opsz` axis; the self-hosted files have the weight axis only (31 kB instead of 49 kB for latin), which renders identically from 12px up (`opsz` tops out at 12) and imperceptibly differently for the 11px `--text-2xs` badges. Revert by changing `--font-sans` and the imports in `main.tsx`.

### Gold
Sampled from the mockups: `#F5C33B` for text ("227", nav underline, Clear all) and `#FCC03C` for the Edit button fill. One token, `#F5C33B`, is used for both. In light theme gold is 1.6:1 on white. It stays as a fill (with dark text), and `--color-accent-text` becomes `#8A6100`.

### Category colors (mockup → token)
| Category | Mockup | Dark token | Why different |
| --- | --- | --- | --- |
| Rally | `#F38D10` | `#F38D10` | — |
| Racing | `#F2461A` | `#FF5A36` | Mockup is 4.24:1 on the card image well; nudged brighter to pass everywhere |
| Supercar | `#1D8BF5` | `#3B9BFF` | Mockup is 4.54:1 on the well, too tight; nudged |
| Retro | `#44C85E` | `#44C85E` | — |
| Premium | *(not in mockup)* | `#A78BFA` | Violet kept from the old palette, lightened for dark surfaces |

### Charts (Phase 23)
Every statistics chart compares magnitudes, so all bars share **one** hue, `--chart-bar`: the gold in dark (11:1 on the card), and `#A87A0A` in light, since the gold fill is only 1.6:1 on white and a chart mark needs ≥ 3:1 (3.85:1 on white, 3.28:1 on the sunken well). Identity comes from text labels (plus a real swatch/logo), never from bar color. The category colors are **not** a chart palette: run through the dataviz validator they fail colorblind separation (Premium ↔ Supercar ΔE 1.2 for protanopia) and the normal-vision floor (Racing ↔ Rally ΔE 11) — fine for the labelled pills and text they were made for, not for telling bars apart.

### States: loading, empty, error (Phase 29)
One vocabulary, `src/components/States/` — never ad-hoc markup:
- **`<Skeleton>`** — the only shimmer (`.skeleton`, keyframes `skeletonShimmer`, off under reduced motion). The caller's class gives it the box of what replaces it (`thumb`, `statTile`, …) so nothing reflows when data lands; `variant="line"` + `skeletonBarTitle`/`skeletonBarMeta` for text lines. Always `aria-hidden`; the loading region says "Loading…" in words.
- **`<EmptyState title icon actions compact>`** — dashed box, icon, title, explanation, a button per way out (`stateButton`, `stateButtonPrimary`). The collection's copy is `describeEmptyResults()` (no models / no search results / no filter results / both).
- **`<ErrorState error onRetry retrying title compact>`** — solid box, `role="alert"`. Copy comes from `describeError()` (`src/utils/error-display.ts`) by cause: **offline** (`navigator.onLine` false), **unreachable** (network failure while online — also how a paused project can look), **paused** (HTTP 540 "Project paused"), **unavailable** (other 5xx), **config**, else the `AppError` message. "Try again" only when retrying can help.
- **`<ImagePlaceholder reason="missing"|"broken">`** — the legacy `COMING_SOON` image as a local, themed line drawing ("Photo coming soon" / "Image unavailable"; icon only at `size="small"`). Used by cards, list/compact rows, the gallery and lightbox.
- **`<OfflineBanner>`** (app-wide toast) and **`<PageLoading>`** (lazy-page Suspense fallback). A page that throws while rendering hits the route error boundary (`RouteErrorPage`, the data router's `errorElement`).
- Queries use `networkMode: "always"` so offline fails fast into an `ErrorState` instead of an endless skeleton, and refetch by themselves on reconnect.

### Light theme
No light mockup exists. The light values are **derived** (same hues, darker text variants) so the existing toggle keeps working. This is flagged for owner review; see ROADMAP open decision #3.

## Contrast table (WCAG 2.x, text needs ≥ 4.5:1)

Generated from `styles.css`, and enforced by `src/styles/contrast.test.ts`. ⚠ = below 4.5:1. That is intentional only for `--color-text-subtle`, which must not be used for text.

### Dark

| Token | Value | on `bg` `#06101c` | on `surface` `#0b1623` | on `surface-raised` `#111e2e` | on `surface-hover` `#16233a` |
|---|---|---|---|---|---|
| `--color-text` | `#eef2f7` | 17.00 | 16.20 | 14.96 | 13.99 |
| `--color-text-secondary` | `#c3cdda` | 11.89 | 11.33 | 10.46 | 9.78 |
| `--color-text-muted` | `#94a3b8` | 7.45 | 7.10 | 6.56 | 6.13 |
| `--color-text-subtle` | `#6b7a90` | 4.38 ⚠ | 4.17 ⚠ | 3.85 ⚠ | 3.60 ⚠ |
| `--color-accent-text` | `#f5c33b` | 11.61 | 11.06 | 10.21 | 9.55 |
| `--cat-rally` | `#f38d10` | 7.85 | 7.48 | 6.91 | 6.46 |
| `--cat-racing` | `#ff5a36` | 6.16 | 5.87 | 5.42 | 5.07 |
| `--cat-supercar` | `#3b9bff` | 6.66 | 6.35 | 5.86 | 5.48 |
| `--cat-premium` | `#a78bfa` | 7.02 | 6.69 | 6.18 | 5.78 |
| `--cat-retro` | `#44c85e` | 8.80 | 8.38 | 7.74 | 7.24 |
| `--color-success` | `#4cc764` | 8.79 | 8.38 | 7.73 | 7.23 |
| `--color-info` | `#509cf0` | 6.69 | 6.38 | 5.89 | 5.51 |
| `--color-warning` | `#f38d10` | 7.85 | 7.48 | 6.91 | 6.46 |
| `--color-danger` | `#ff5a4a` | 6.20 | 5.91 | 5.46 | 5.10 |
| `--color-on-accent` on `--color-accent` | `#0a1220` / `#f5c33b` | 11.38 | | | |

### Light

| Token | Value | on `bg` `#f3f5f9` | on `surface` `#ffffff` | on `surface-raised` `#ffffff` | on `surface-hover` `#e4e9f1` |
|---|---|---|---|---|---|
| `--color-text` | `#0e1726` | 16.46 | 17.96 | 17.96 | 14.73 |
| `--color-text-secondary` | `#334155` | 9.49 | 10.35 | 10.35 | 8.49 |
| `--color-text-muted` | `#5b6778` | 5.26 | 5.74 | 5.74 | 4.71 |
| `--color-text-subtle` | `#97a3b4` | 2.34 ⚠ | 2.56 ⚠ | 2.56 ⚠ | 2.10 ⚠ |
| `--color-accent-text` | `#8a6100` | 5.08 | 5.54 | 5.54 | 4.54 |
| `--cat-rally` | `#a64b08` | 5.30 | 5.78 | 5.78 | 4.74 |
| `--cat-racing` | `#c2310f` | 5.14 | 5.61 | 5.61 | 4.61 |
| `--cat-supercar` | `#1565c0` | 5.26 | 5.75 | 5.75 | 4.71 |
| `--cat-premium` | `#6d28d9` | 6.51 | 7.10 | 7.10 | 5.83 |
| `--cat-retro` | `#17702f` | 5.67 | 6.19 | 6.19 | 5.07 |
| `--color-success` | `#17702f` | 5.67 | 6.19 | 6.19 | 5.07 |
| `--color-info` | `#1565c0` | 5.26 | 5.75 | 5.75 | 4.71 |
| `--color-warning` | `#a64b08` | 5.30 | 5.78 | 5.78 | 4.74 |
| `--color-danger` | `#c2310f` | 5.14 | 5.61 | 5.61 | 4.61 |
| `--color-on-accent` on `--color-accent` | `#0a1220` / `#f5c33b` | 11.38 | | | |

Focus ring vs page (non-text, needs ≥ 3:1): dark `#f5c33b` 11.61:1 · light `#8a6100` 5.08:1.

Selected-state indicators (`--state-selected-border`, non-text, ≥ 3:1 on every surface): dark `#f5c33b` ≥ 9.55:1 · light `#8a6100` ≥ 4.54:1.
