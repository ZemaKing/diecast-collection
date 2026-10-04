# Accessibility

Target: **WCAG 2.2 AA**. Audit and fixes are from ROADMAP Phase 34 (2026-10-04). Phase 35 adds `@axe-core/playwright` to the E2E suite, which covers the admin pages too.

## How to check

```bash
npm run build && npm run preview          # another terminal, serves dist/ on :4173
npm run a11y:axe                          # every scenario × dark/light × desktop/mobile
npm run a11y:axe -- --only details --theme light --viewport mobile
npm run a11y:axe -- --all-impacts --incomplete --json out.json   # minor/moderate + "needs review" too
```

`scripts/a11y/axe.mjs` runs axe-core in a real headless Edge/Chrome (`scripts/lib/headless.mjs`, the same driver as `perf:vitals`). jsdom can't compute colors or layout, so contrast and target size need a real browser. It covers 23 scenarios: the collection in all three view modes, filtered, and empty; the filter dropdowns, sort, and the filter sheet; Quick View; the mobile drawer; the details page and its tabs; the lightbox; the brand and manufacturer index and detail pages; statistics; about; sign-in; and both 404s. Each runs in both themes at 1280 px and at 375 px (touch). The `target-size` rule (WCAG 2.2, 24 px) is switched on. Any critical or serious violation that isn't listed under [Exceptions](#exceptions) fails the run.

**Not covered by the script:** `/admin/*` needs a signed-in owner, and Claude never types the password. The admin form's labelling and error wiring were reviewed in code: every field gets `id`, `aria-invalid` and `aria-describedby` from one `control()` helper, and save errors use `role="alert"`. Phase 35 runs axe there against the test project.

## Results

| | Before (baseline) | After |
| --- | --- | --- |
| axe, 88 runs (23 scenarios × 2 themes × 2 viewports, minus desktop/mobile-only ones) | 0 critical · 0 serious · 1 moderate (`heading-order` in the filter sheet) · 0 "needs review" | **0 violations of any impact · 0 "needs review"** |
| Token contrast (`src/styles/contrast.test.ts`) | text ≥ 4.5:1, chart bars and focus ring ≥ 3:1 | + selected-state indicators ≥ 3:1 on every surface, both themes |

axe passed almost everywhere before this phase; the real gaps were the kind automated rules can't see. They were found by a scripted keyboard walk (Tab through every page in a real browser, recording each focus stop, whether its ring is visible and whether it's covered) and by reading the DevTools accessibility tree.

## What changed in Phase 34

| Area | Problem | Fix |
| --- | --- | --- |
| Skip link | No way past the header: 18 Tab stops before the first model on desktop | "Skip to content" is the first Tab stop on every page (`Header`). It focuses `<main id="main-content" tabIndex={-1}>`, which every page now has (`MAIN_CONTENT_ID`) |
| Page titles | Every route was titled "ZemaKing Diecast Collection" (WCAG 2.4.2) | `usePageTitle()` on every page gives "Porsche 911 GT3-RS · ZemaKing Diecast Collection", "Statistics · …", "Porsche · Brands · …" and so on (`formatPageTitle()`) |
| Focus on navigation | After a client-side page change, focus fell to `<body>`, nothing was announced, and Tab restarted at the top | `useFocusOnNavigation()` (in `Header`) focuses the new page's `<h1>` (or `<main>`), waiting up to ~1.5 s for a heading that loads with its data. It leaves the session's first page alone, never moves focus on filter/search changes, and yields to focus already placed: the return-to-model card, or the header search box |
| Header search across pages | Typing in the header search on any page except the collection navigated to `/?q=`, and the new page's header dropped the focus, so typing stopped | The navigation carries `{focusSearch: true}` and the new header puts the caret back in the box |
| Filter sheet (phone/tablet) | `aria-modal` div with no focus management: focus stayed on the page behind, Tab escaped it, and only Escape returned focus | `useFocusTrap()`: focus moves to the first control, Tab/Shift+Tab wrap inside, and every way of closing (Escape, scrim, ✕, "Show N models") returns focus to Filters. The title is an `<h2>` labelling the dialog (this fixed the `heading-order` finding) |
| Mobile drawer | Claimed `role="dialog" aria-modal` but wasn't modal (its ✕ is the header's ☰ button, and the page stays live) | Now an honest disclosure, like `AccountMenu`. Opening focuses the first link; Escape closes it and returns focus to ☰; a click outside, or Tab moving focus out, just closes it |
| Card / row link names | A card's link was named by its whole content, with the name twice and the badges first ("Aston Martin V12 Vantage GT3 (2013) EBBRO 1:43 #50 Masaki Kano Aston Martin V12 Vantage GT3 Aston Martin 2013 EBBRO Racing") | `modelLinkLabel()`: "Aston Martin V12 Vantage GT3, 2013, Aston Martin, EBBRO, Racing, #50, Masaki Kano, 1:43". The name comes first, which also satisfies label-in-name for voice control. Same in Grid, List and Compact. Quick View is "Quick view: {name}" |
| Browse tiles | "…1969–20224 manufacturers" (the separator dot is `aria-hidden`) | A visually hidden comma |
| Filter counts | The trigger's badge read as a bare number ("Brand 2") | "Brand 2 selected" / "Filters 3 active" |
| Selected category pill | Selected was shown only by a faint fill and bolder text | It also gets a ✓ |
| Selected/current indicators, light theme | Nav underline, active details tab, active/open filter trigger, active view button, current gallery thumbnail, selected color ring and admin tabs were drawn in the gold `--color-accent`: **1.6:1 on white**, below the 3:1 for state cues (WCAG 1.4.11) | They use `--state-selected-border`. Dark theme: gold (≥ 9:1). Light theme: `--color-accent-text` `#8a6100` (≥ 4.5:1 on every surface). Tested |
| Brand/manufacturer logos, light theme | The 64 shipped SVGs are fixed `#A9B1BF`: 2:1 on white, nearly invisible | `--logo-shipped-filter: brightness(0.5)` in light theme (≈ `#55595F`, 7:1), applied to `img[src^="/brands/"]` and `img[src^="/manufacturers/"]` only. Uploaded logos keep their own colors. Logos are exempt from the contrast criteria, but they carry the brand, so they should be legible |
| Back to top | Smooth scroll even with reduced motion, and focus stayed on the button at the bottom of a 227-card page | Instant scroll under `prefers-reduced-motion`, and focus moves to `<main>` |
| Breadcrumb links | 18 px tall | `min-height: var(--target-min)` (new token, 24 px) |

`useFocusTrap`, `useFocusOnNavigation` and `usePageTitle` are in `src/hooks/`; their pure parts (`wrapFocusTarget`, `formatPageTitle`, `FOCUSABLE_SELECTOR`) are in `src/utils/a11y.ts` and unit-tested.

## Keyboard map

| Where | Keys |
| --- | --- |
| Every page | Tab → "Skip to content" (Enter = jump to the page's content), then logo, nav, search, theme, socials |
| Header search | Type to filter the collection from any page (Enter isn't needed; it's debounced). ✕ clears it |
| Filter dropdowns / Sort (desktop) | Enter/Space on the trigger opens it; Tab through options; Escape closes it and returns focus to the trigger; a click outside closes it |
| Filter sheet (< 1024 px) | Enter on Filters opens it; focus is trapped inside; Escape / ✕ / "Show N models" / scrim closes it and returns focus to Filters |
| View mode | Grid / List / Compact are toggle buttons (`aria-pressed`) |
| Cards | Each card is one link (Enter opens the details page). On a hover-capable device the next Tab stop is "Quick view: …". Coming back via the breadcrumb returns focus to the card |
| Quick View, lightbox | Native modal `<dialog>`: focus is inside, Escape closes it, and focus returns to the trigger. Lightbox ←/→ change photo, and a polite live region says "Photo n of N" |
| Details tabs | ←/→/Home/End move between tabs (roving tabindex); Tab goes into the panel |
| Mobile drawer | Enter on ☰ opens it, with focus on the first link; Escape closes it and returns focus to ☰; Tab past the last link closes it |
| Admin model form | Combobox: ↓/↑/Home/End to move, Enter to pick, Escape to close. Description toolbar: Ctrl+B / Ctrl+I. Photos: each photo's menu has Make main photo / Move earlier / Move later / Remove (dragging is never required) |

## Contrast

- Text tokens: every text color on every surface, in both themes, is ≥ 4.5:1 (table in `docs/DESIGN-TOKENS.md`). That includes the known risks: gold `#f5c33b` is 9.5–11.6:1 on navy, Racing `#ff5a36` 5.1–6.2:1 and Supercar `#3b9bff` 5.5–6.7:1 on dark surfaces, and muted `#94a3b8` 6.1–7.5:1. All of it is enforced by `contrast.test.ts`.
- Non-text cues (≥ 3:1): focus ring, chart bars and selected-state indicators, all tested. On card photos, the scale, number and driver badges sit on their own overlay plates. The manufacturer logo sits directly on the light studio photo (darkened in light theme, see above). axe checked the rendered pages and had nothing to flag or review.
- The filled category pill from the mockup (Phase 30 note): not adopted. The outlined pill is what passes everywhere; a tinted fill would need every category's text re-checked on its own tint, in both themes. It stays outlined unless the owner wants the fill.

## Motion

Every duration token is `0ms` under `prefers-reduced-motion: reduce` (`styles.css`). The keyboard walk confirmed that no element animates or transitions under it. The skeleton shimmer, gallery and browse animations have their own reduced-motion blocks, and Back to top no longer smooth-scrolls.

## Target size

WCAG 2.2 AA (2.5.8) asks for 24 × 24 px or enough spacing. axe's `target-size` passes on every page. The project's own aim for touch is `--tap-target` (44 px). Measured exceptions to the 44 px aim, all of which still meet AA:

| Target | Size | Why it stays |
| --- | --- | --- |
| View-mode buttons, phone | 36 × 38 | Filters · 3 views · Sort have to fit on a 360 px row (Phase 32); the group itself is 44 px tall |
| Category pills | ~25 px tall | Mockup pills; ≥ 24 px and spaced |
| Theme toggle, socials (desktop only) | 26 × 24, 32 × 32 | Pointer-only sizes; on phones they're 44 × 44 |
| Quick view button | 111 × 36 | Hidden on touch-only devices (`hover: none`) |
| Filter checkboxes | 13 × 13 | The whole label row is the target (44 px) |

## Screen-reader spot check

Done with Chrome's computed accessibility tree (DevTools protocol), **not a real screen reader**: names and roles of the cards, Quick View buttons, browse tiles, filter controls, tabs, statistics tables (`<table>` with captions) and meter, and live regions (results count, gallery counter). A pass with NVDA (Windows) or VoiceOver (iPhone) is still worth doing by hand. It's listed as an owner check in the roadmap.

## Exceptions

None needed: the run has zero violations, so `EXCEPTIONS` in `scripts/a11y/axe.mjs` is empty. Known, accepted limits:

- **Meta lines inside flex rows** (details page "2003 · Altaya · 1:43", Quick View): the dots are `aria-hidden`, and screen readers read the parts as separate items, so nothing runs together audibly. Card and row links aren't affected (they have their own names).
- **Details page heading after slow loads**: if the model takes more than ~1.5 s to load, focus settles on `<main>` instead of the `<h1>`.
- **Admin pages**: reviewed in code only until Phase 35's signed-in axe run.
