# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Redesign in progress

A phased redesign + Supabase migration is under way. **Read `ROADMAP.md` first** (findings in `docs/AUDIT.md`; mockups in `diecast-details/`). Implement **one phase at a time**, report per the workflow rules in the roadmap, update its checkboxes, then stop and wait for approval. Trucks are being retired (not migrated). Sections below describe the *current* JSON-based architecture and will be rewritten in Phases 11, 25 and 36.

## What this is

A React + TypeScript + Vite single-page app that showcases a personal diecast model collection ("ZemaKing Diecast Collection"), split into two galleries: Cars and Trucks. There is no backend — all model data lives in static JSON files and all images are hosted externally on postimg.cc.

## Commands

**Package manager: npm only** (`package-lock.json` is the lockfile; `packageManager` is pinned in `package.json`). Don't use pnpm/yarn — their lockfiles are git-ignored. Use `npm ci` for a clean install.

- `npm run dev` — start Vite dev server (opens browser automatically)
- `npm run build` — type-check (`tsc -b`) then production build via Vite
- `npm run typecheck` — type-check only (`tsc -b`; both tsconfigs are `noEmit`)
- `npm run lint` — run ESLint over the whole repo
- `npm test` — run the Vitest suite once (`npm run test:watch` for watch mode)
- `npm run preview` — preview the production build locally

**Tests**: Vitest (jsdom environment, configured in `vite.config.ts`), files are `src/**/*.test.{ts,tsx}` co-located with the code. Current suites are *characterization tests* for the pure logic in `src/utils/` (filtering, URL params, color swatches), asserting against the real `car-models.json` — so **adding a car changes some expected counts** in `src/utils/collection-filters.test.ts`; update them deliberately.

**Env**: `.env.example` lists variables; copy to `.env.local` (git-ignored). `import.meta.env` is typed in `src/vite-env.d.ts`. Only `VITE_*` vars reach the browser — never put secrets there.

**Supabase** (see `docs/SUPABASE-SETUP.md`, schema in `docs/SCHEMA.md`): dedicated project `zemaking-diecast-car-collection`; **all DB objects live in the `diecast` schema, not `public`**. Single client in `src/lib/supabase.ts` (validates env via `src/lib/env.ts`, which rejects secret/service_role keys); normalize every Supabase/fetch error with `toAppError()` from `src/lib/errors.ts`. Only `src/lib` and `src/services` may import `@supabase/supabase-js`. `src/lib/database.types.ts` is generated (`npm run db:types`) — never hand-edit. `npm run supabase:check` tests the connection; `postbuild` fails the build if a secret key is in `dist/`. The UI does not read Supabase yet (JSON until Phase 10).

## Architecture

**Routing** (`src/main.tsx`, `src/App.tsx`): `BrowserRouter` wraps a small `Routes` table — `/` is the landing page, `/cars` and `/trucks` both render `CollectionPage` with a `type` prop (`"cars" | "trucks"`), anything else redirects to `/`.

**Data model** (`src/types.ts`, `src/data/*.json`): Each collection is a flat JSON array of `DiecastModel` typed as `car-models.json` / `truck-models.json`, imported directly and cast with `as DiecastModel[]` — there is no runtime validation, so malformed entries fail silently or only surface as UI bugs.
- `id` is a slug of the form `{brand}-{model}-{year}-{manufacturer}-{color}`, used both as React key and as the DOM element id that deep-linking scrolls to (see below).
- `color`/`hex` are arrays because some models have multi-color liveries (rendered as a conic-gradient by `ColorCircle`).
- **Known inconsistency**: `DiecastModel.category` in `types.ts` only lists `"Rally" | "Racing" | "Supercar" | "Premium"`, but the JSON data also uses `"Retro" | "Transport" | "Construction" | "Utility" | "Off-Road"`. Since data is force-cast, TypeScript won't catch new category values — when adding a model with a new category, update `types.ts` and add `--cat-<slug>` tokens (dark + light) in `styles.css`.

**Pure logic** (`src/utils/`): `collection-filters.ts` (filter predicate, `uniqSorted`, filter options, lookup by id), `url-params.ts` (filters ↔ query params, `?model=` add/remove — all return new `URLSearchParams`, never mutate), `color.ts` (hex → flat color / conic-gradient). Components call these; keep new logic here, not inline, so it stays testable.

**CollectionPage** (`src/pages/collection-page/collection-page.tsx`) is the core page: it holds filter state (`Sidebar`), renders the filtered grid (`ModelCard`), and drives `DetailsModal` off a `?model=<id>` URL query param rather than local state alone. Notable behavior baked in here:
- Filters (brand/manufacturer/category/color) are synced to the URL as query params by `Sidebar`, and the model id is synced by `CollectionPage` itself — both read/write `useSearchParams` independently, so changes to one must not clobber the other's params (see the `new URLSearchParams(searchParams)` merge pattern used everywhere).
- Opening a model via URL (e.g. a shared link, or a filtered link that doesn't have the card in view) scrolls the card into view before opening the modal, gated by timeouts and a `lastOpenedModelIdRef` to avoid re-triggering on every render.

**Adding new models**: this is the most common change (see git history — most commits are of the form `New Car(s): X`, `New Truck: Y`). To add one, append an object to `src/data/car-models.json` or `truck-models.json` matching `DiecastModel`, add a thumbnail + full image URL (currently all hosted on postimg.cc), and ensure a brand SVG exists at `public/brands/{brand}.svg` (used by both `ModelCard` and `DetailsModal`, matched by exact brand string). Insert entries in alphabetical order by `id` within the file.

- The user often gives only partial info (e.g. "add Brand Model, from Manufacturer, [color] one") and expects the rest — year, category, exact color/hex — to be researched online rather than guessed, since these describe a real vehicle/model. Search for the real-world vehicle's production year/color and, where relevant, the specific DeAgostini (or other manufacturer) collectible issue, and cite sources when reporting back.
- If the user says images will be added later ("leave images to me" / "add mock links"), use placeholder URLs in the existing `i.postimg.cc/<id>/<slug>-thumbnail.png` / `i.postimg.cc/<id>/<slug>.png` format (e.g. `i.postimg.cc/MOCKMOCK/...`) so the entry matches the shape of real entries and is easy to find-and-replace later.
- If no SVG exists yet at `public/brands/{brand}.svg` for a new brand, flag this to the user rather than silently leaving a broken image.

**Styling**: plain CSS per-component (no CSS modules/Tailwind/styled-components) — each component/page has a co-located `.css` file imported directly, plus a shared `src/styles/styles.css` that holds **all design tokens** (see `docs/DESIGN-TOKENS.md`; live reference at `/dev/tokens` on the dev server).
- Use semantic tokens only (`var(--color-surface)`, `var(--space-lg)`, `var(--text-sm)`, …) — never hard-code colors/sizes. Tests fail on undefined `var(--x)` references and on new hard-coded colors outside `styles.css`. Legacy names (`--bg`, `--panel`, `--muted`…) are aliases for old components; don't use them in new code.
- Category colors are `--cat-<slug>` tokens; `CategoryLabel` resolves them via `categoryColorVar()` (`src/utils/category.ts`). A new category needs a `--cat-<slug>` in both the dark (`:root`) and light blocks — a test checks this against the data.
- Breakpoints: mobile < 640, tablet 640–1023, desktop ≥ 1024, wide ≥ 1600 — literal in CSS, mirrored in `src/styles/breakpoints.ts`.
- Font is Nunito Sans (`--font-sans`, loaded in `index.html`).

**Deployment**: Vercel (`vercel.json` rewrites all paths to `/` to support client-side routing on refresh/deep links).