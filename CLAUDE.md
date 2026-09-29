# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Redesign in progress

A phased redesign + Supabase migration is under way. **Read `ROADMAP.md` first** (findings in `docs/AUDIT.md`; mockups in `diecast-details/`). Implement **one phase at a time**, report per the workflow rules in the roadmap, update its checkboxes, then stop and wait for approval. Trucks were retired in Phase 11 (not migrated — see below). Sections below describe the architecture as of Phase 11 and will be rewritten further in Phases 25 and 36.

## What this is

A React + TypeScript + Vite single-page app that showcases a personal diecast car collection ("ZemaKing Diecast Collection"). Model data and images (hosted externally on postimg.cc, migrating to Supabase Storage in Phase 21) are read from Supabase (`src/services/`) — there is no other backend. A former "Trucks" gallery was retired in Phase 11; its JSON lives on only as an archive, not part of the product.

## Commands

**Package manager: npm only** (`package-lock.json` is the lockfile; `packageManager` is pinned in `package.json`). Don't use pnpm/yarn — their lockfiles are git-ignored. Use `npm ci` for a clean install.

- `npm run dev` — start Vite dev server (opens browser automatically)
- `npm run build` — type-check (`tsc -b`) then production build via Vite
- `npm run typecheck` — type-check only (`tsc -b`; both tsconfigs are `noEmit`)
- `npm run lint` — run ESLint over the whole repo
- `npm test` — run the Vitest suite once (`npm run test:watch` for watch mode)
- `npm run preview` — preview the production build locally

**Tests**: Vitest (jsdom environment, configured in `vite.config.ts`), files are `src/**/*.test.{ts,tsx}` co-located with the code (a `*.test-data.ts` file is a test-only fixture/helper module, not a suite — Vitest only picks up `*.test.ts`). `src/utils/collection-filters.test.ts` and `src/services/*.test.ts` are *characterization tests* asserting against the real `src/data/car-models.json` (kept as a migration source, test fixture and backup — never imported by app/runtime code, only by tests and `scripts/import/`) — so **adding a car changes some expected counts** in both; update them deliberately.

**Env**: `.env.example` lists variables; copy to `.env.local` (git-ignored). `import.meta.env` is typed in `src/vite-env.d.ts`. Only `VITE_*` vars reach the browser — never put secrets there.

**Supabase** (see `docs/SUPABASE-SETUP.md`, schema in `docs/SCHEMA.md`): dedicated project `zemaking-diecast-car-collection`; **all DB objects live in the `diecast` schema, not `public`**. Single client in `src/lib/supabase.ts` (validates env via `src/lib/env.ts`, which rejects secret/service_role keys); normalize every Supabase/fetch error with `toAppError()` from `src/lib/errors.ts`. Only `src/lib` and `src/services` may import `@supabase/supabase-js` (enforced by an ESLint `no-restricted-imports` rule). Schema changes = a new file in `supabase/migrations/` (owner applies it in the dashboard SQL editor — the CLI isn't linked), then update `src/lib/database.types.ts` in the generator's format and run `npm run verify:types` + `npm run verify:rls` (needs `RLS_*` logins in `.env.local`). `npm run supabase:check` tests the connection; `postbuild` fails the build if a secret key is in `dist/`. The 227 cars were imported on 2026-09-28 (`npm run import:cars`, see `scripts/import/README.md`) and verified to match the JSON exactly (`npm run verify:migration`, `docs/migration-report.md`). **The UI reads cars from Supabase as of Phase 10** (`src/services/models.ts`'s `getModels()`, via TanStack Query) — so a new car must be added to `src/data/car-models.json` **and then imported** (`npm run import:cars -- --apply`, safe to re-run) before it shows up anywhere.

## Architecture

**Routing** (`src/main.tsx`, `src/App.tsx`): `BrowserRouter` around a small `Routes` table, both wrapped in a `QueryClientProvider` (`src/lib/query-client.ts`, one `QueryClient` for the app — TanStack Query is the caching/loading-state layer for `src/services` calls). `/` renders `CollectionPage` directly, `/cars` and `/trucks` redirect to `/` preserving the query string/hash (old shared links, e.g. `?model=<id>` or `?brand=Ford`, still work), anything else redirects to `/`.

**Data access** (`src/services/`, ROADMAP Phase 9–10): the only code allowed to import `@supabase/supabase-js` outside `src/lib`. Domain types (`ModelSummary`, `Model`, `LookupRef`, `Category`, `Driver`, …) and row→domain mappers live in `types.ts`/`mappers.ts`; reads are in `models.ts` (`getModels()`, `getModelBySlug()`) and `lookups.ts`; `collection-query.ts` is pure client-side filter/search/sort/facet-count logic over an already-loaded `ModelSummary[]` (load once, query in memory — no per-filter round trip). `legacy-adapter.ts`'s `toLegacyModel()` bridges `ModelSummary` to the pre-redesign `DiecastModel` shape so the components below (predating the migration) didn't need to change in Phase 10; it goes away once they're rebuilt against `ModelSummary` directly (Phase 16+).

**Data model** (`src/types.ts`): `DiecastModel` is the shape the *pre-redesign UI components* (`Sidebar`, `ModelCard`, `DetailsModal`, `src/utils/collection-filters.ts`, `src/utils/url-params.ts`) still consume; `CollectionPage` gets it via `toLegacyModel()` (above), not by importing JSON.
- `id` is a slug of the form `{brand}-{model}-{year}-{manufacturer}-{color}` (`models.slug` in Supabase, verbatim from the legacy JSON `id` — see `docs/SCHEMA.md`), used both as React key and as the DOM element id that deep-linking scrolls to (see below).
- `color`/`hex` are arrays because some models have multi-color liveries (rendered as a conic-gradient by `ColorCircle`).
- **Known inconsistency**: `DiecastModel.category` in `types.ts` only lists `"Rally" | "Racing" | "Supercar" | "Premium"`, but the data also uses `"Retro"`. `toLegacyModel()` casts through it, so TypeScript won't catch a new category value — when adding a model with a new category, update `types.ts` and add `--cat-<slug>` tokens (dark + light) in `styles.css`.
- `src/data/car-models.json` (227 cars) is kept as the importer's source, a test fixture, and a backup — **never imported by app/runtime code**, only by `scripts/import/` and tests. `archive/legacy-data/truck-models.json` (39 trucks) is the retired truck gallery's data, archived (not deleted) and referenced by nothing.

**Pure logic** (`src/utils/`): `collection-filters.ts` (filter predicate, `uniqSorted`, filter options, lookup by id — operates on `DiecastModel[]`, i.e. runs on the Supabase data after `toLegacyModel()`), `url-params.ts` (filters ↔ query params, `?model=` add/remove — all return new `URLSearchParams`, never mutate), `color.ts` (hex → flat color / conic-gradient). Components call these; keep new logic here, not inline, so it stays testable. (`src/services/collection-query.ts` is the equivalent pure module for the `ModelSummary` domain type, used once Phase 13+ replaces this filter pipeline.)

**CollectionPage** (`src/pages/collection-page/collection-page.tsx`) is the core page: it loads cars with `useQuery(getModels)`, holds filter state (`Sidebar`), renders the filtered grid (`ModelCard`), and drives `DetailsModal` off a `?model=<id>` URL query param rather than local state alone. Notable behavior baked in here:
- Filters (brand/manufacturer/category/color) are synced to the URL as query params by `Sidebar`, and the model id is synced by `CollectionPage` itself — both read/write `useSearchParams` independently, so changes to one must not clobber the other's params (see the `new URLSearchParams(searchParams)` merge pattern used everywhere).
- Opening a model via URL (e.g. a shared link, or a filtered link that doesn't have the card in view) scrolls the card into view before opening the modal, gated by timeouts and a `lastOpenedModelIdRef` to avoid re-triggering on every render.
- Minimal loading/error states (`.contentEmpty`/`.contentError`, a manual retry button) — consolidated into the shared vocabulary from `docs/DESIGN-TOKENS.md` in Phase 29.

**Adding new models**: this is the most common change (see git history — most commits are of the form `New Car(s): X`). To add one, append an object to `src/data/car-models.json` matching `DiecastModel`, add a thumbnail + full image URL (currently all hosted on postimg.cc), ensure a brand SVG exists at `public/brands/{brand}.svg` (used by both `ModelCard` and `DetailsModal`, matched by exact brand string) — **then import it into Supabase** (`npm run import:cars -- --apply`; see the Supabase bullet above), since that's what the UI actually reads. Insert entries in alphabetical order by `id` within the file.

- The user often gives only partial info (e.g. "add Brand Model, from Manufacturer, [color] one") and expects the rest — year, category, exact color/hex — to be researched online rather than guessed, since these describe a real vehicle/model. Search for the real-world vehicle's production year/color and, where relevant, the specific DeAgostini (or other manufacturer) collectible issue, and cite sources when reporting back.
- If the user says images will be added later ("leave images to me" / "add mock links"), use placeholder URLs in the existing `i.postimg.cc/<id>/<slug>-thumbnail.png` / `i.postimg.cc/<id>/<slug>.png` format (e.g. `i.postimg.cc/MOCKMOCK/...`) so the entry matches the shape of real entries and is easy to find-and-replace later.
- If no SVG exists yet at `public/brands/{brand}.svg` for a new brand, flag this to the user rather than silently leaving a broken image.

**Styling**: plain CSS per-component (no CSS modules/Tailwind/styled-components) — each component/page has a co-located `.css` file imported directly, plus a shared `src/styles/styles.css` that holds **all design tokens** (see `docs/DESIGN-TOKENS.md`; live reference at `/dev/tokens` on the dev server).
- Use semantic tokens only (`var(--color-surface)`, `var(--space-lg)`, `var(--text-sm)`, …) — never hard-code colors/sizes. Tests fail on undefined `var(--x)` references and on new hard-coded colors outside `styles.css`. Legacy names (`--bg`, `--panel`, `--muted`…) are aliases for old components; don't use them in new code.
- Category colors are `--cat-<slug>` tokens; `CategoryLabel` resolves them via `categoryColorVar()` (`src/utils/category.ts`). A new category needs a `--cat-<slug>` in both the dark (`:root`) and light blocks — a test checks this against the data.
- Breakpoints: mobile < 640, tablet 640–1023, desktop ≥ 1024, wide ≥ 1600 — literal in CSS, mirrored in `src/styles/breakpoints.ts`.
- Font is Nunito Sans (`--font-sans`, loaded in `index.html`).

**Deployment**: Vercel (`vercel.json` rewrites all paths to `/` to support client-side routing on refresh/deep links).