# ZemaKing Diecast Collection — Redesign & Supabase Migration Roadmap

Audit findings: [`docs/AUDIT.md`](docs/AUDIT.md). Visual source of truth: [`diecast-details/`](diecast-details/) (Desktop mockups; Tablet/Mobile references still to be supplied — see [Open decisions](#open-decisions--inputs-needed)).

There was no earlier roadmap in this repo, so numbering starts at 1. **Phases 1–3 are complete. Phase 4 (schema doc) is written and awaits owner approval of `docs/SCHEMA.md`.**

---

## Workflow rules

1. **One phase at a time.** Never continue into the next phase without explicit approval.
2. At the end of every phase, report: (1) what changed, (2) files added, (3) files modified, (4) DB migrations, (5) manual actions required from the owner, (6) test/build/lint status, (7) roadmap updated, then **STOP**.
3. Don't delete working functionality until its replacement is verified. Nothing in `src/data/*.json` or `public/` is deleted before Phase 36, and only with explicit approval.
4. Visual work follows the mockups. If an implementation constraint forces a substantial deviation, explain it *before* making the change.
5. New dependencies need a one-line justification in the phase report.
6. `SUPABASE_SERVICE_ROLE_KEY` never enters frontend code, a `VITE_*` variable, or git.

## Global Definition of Done (applies to every phase, in addition to the phase's own DoD)

- `npm run build` (includes `tsc -b`) and `npm run lint` pass with no new warnings; `npm test` passes (from Phase 2 on).
- UI phases: no horizontal page scroll at 360 / 768 / 1280 px; only design tokens (no new hard-coded colors/spacing); theme toggle still works.
- Touched behavior has tests where it is pure logic; UI is checked in the browser at desktop + one narrow width.
- `ROADMAP.md` checkboxes and status table updated.

> **Responsive principle:** components are built desktop-first against the Desktop mockups but must remain usable at narrow widths in the same phase. Phases 30–32 are *fidelity passes* against the dedicated mockups, not the first time mobile is considered.

## Architecture target

```
React components ─► hooks / URL state ─► src/services (repositories) ─► src/lib/supabase (single client) ─► Postgres (RLS) + Storage
```

- Components never import `@supabase/supabase-js` (enforced with an ESLint `no-restricted-imports` rule in Phase 9).
- **Read strategy:** at 227 models (hundreds → low thousands) load one lightweight summary list once, cache it, and filter/search/sort/facet client-side. That gives instant filters and free facet counts. Server-side pagination is only added if Phase 33 measurements justify it (rule of thumb: > ~1,500 models).
- **Trucks are not part of the redesign** and are **not imported** into Supabase. `truck-models.json` is archived (Phase 11), not deleted.
- Local JSON is never a runtime fallback. It survives only as migration source, test fixture and backup.

## Status

| # | Phase | Status | Needs from owner |
| --- | --- | --- | --- |
| 1 | Current Application Audit | ✅ Done | Approve roadmap |
| 2 | Test & Tooling Baseline | ✅ Done | Approve phase |
| 3 | Design Foundation (tokens) | ✅ Done | Approve phase; review font + light theme |
| 4 | Supabase Schema Design | 🟡 Awaiting approval | Approve `docs/SCHEMA.md` (§12); answer D15 (DTM) |
| 5 | Supabase Project & Client Integration | ✅ Done | Reset DB password; disable sign-ups |
| 6 | Migrations & RLS | ⬜ | Run `db push`, create owner user |
| 7 | JSON → Supabase Import Tool | ⬜ | Service-role key in `.env.local` (local only) |
| 8 | Migration Verification | ⬜ | Sign off on report |
| 9 | Data Access Layer | ⬜ | — |
| 10 | Cars Read from Supabase | ⬜ | — |
| 11 | Retire Trucks & Runtime JSON | ⬜ | Confirm truck archive |
| 12 | Application Shell & Routing | ⬜ | Logo asset; About content |
| 13 | Collection Toolbar & URL State | ⬜ | — |
| 14 | Advanced Filter Panel | ⬜ | Tablet/Mobile filter mockups |
| 15 | Search & Sorting | ⬜ | — |
| 16 | Model Card Redesign | ⬜ | — |
| 17 | Collection Hero & Grid | ⬜ | Hero background image |
| 18 | View Modes | ⬜ | Decide Showcase mode |
| 19 | Model Details Page | ⬜ | Decide public "My Collection" fields |
| 20 | Gallery, Lightbox & Quick View | ⬜ | — |
| 21 | Supabase Storage Migration | ⬜ | Run image migration |
| 22 | Manufacturer & Brand Browsing | ⬜ | Mockups (none exist) |
| 23 | Collection Statistics | ⬜ | Mockup (none exists) |
| 24 | Authentication & Admin Protection | ⬜ | Login mockup |
| 25 | Model Form — Core & CRUD | ⬜ | — |
| 26 | Model Form — Rich Sections | ⬜ | Decide rich-text vs plain |
| 27 | Image Management CRUD | ⬜ | — |
| 28 | Supporting Data Management | ⬜ | — |
| 29 | Loading / Empty / Error States | ⬜ | — |
| 30 | Desktop Fidelity Pass | ⬜ | — |
| 31 | Tablet Responsive Pass | ⬜ | **Tablet mockups** |
| 32 | Mobile Responsive Pass | ⬜ | **Mobile mockups** |
| 33 | Performance | ⬜ | — |
| 34 | Accessibility | ⬜ | — |
| 35 | End-to-End Testing | ⬜ | Separate test Supabase project |
| 36 | Legacy Cleanup | ⬜ | Explicit approval to delete archives |
| 37 | Production Verification | ⬜ | Vercel env vars; go/no-go |

### Mapping from the original draft (31–67) to this roadmap

Draft 31→1 · 32→3 · 33→4 · 34→5 · 35→6 · 36→7 · 37→8 · 38→9 · 39→**10 + 11** · 40→12 · 41 (hero)→17 · 42→13 · 43→14 · 44+45→15 · 46→16 · 47→17 · 48→18 · 49→19 · 50→20 · 51→21 · 52+53→22 · 54→23 · 55→24 · 56→25+26 · 57→27 · 58→28 · 59/60/61→30/31/32 · 62→29 · 63→33 · 64→34 · 65→2 (foundation) + 35 (E2E) · 66→36 · 67→37.

Changes: **testing foundation moved to Phase 2** (the migration and query logic need tests from the start), **trucks retirement added** (Phase 11), **Supabase split kept as separate phases 4–10**, and merged where the work is one component family (search+sort, manufacturer+brand, gallery+lightbox+quick view). 37 phases total — slightly above the 25–35 target; the two I'd cut first if you want fewer are 30 (fold into 37) and 28 (fold into 25/27).

---

## Phase 1 — Current Application Audit ✅

### Goal
Understand the existing app, data and mockups before designing anything.

### Tasks
- [x] Inspect repo, routes, components, state/data flow
- [x] Profile `car-models.json` / `truck-models.json` (counts, inconsistencies, duplicates, orphans)
- [x] Inspect image handling, filtering/sorting/search, auth (none), responsive CSS
- [x] Review the three mockups; list gaps
- [x] Write `docs/AUDIT.md`
- [x] Produce this roadmap

### Verification
- [x] Every runtime JSON usage located (`collection-page.tsx:10-11` only)
- [x] Dataset counts reconciled against the "227 models" in the mockups

### Definition of Done
`docs/AUDIT.md` and `ROADMAP.md` exist and are approved by the owner. No application code changed.

---

## Phase 2 — Test & Tooling Baseline ✅

### Goal
Establish a safety net *before* logic is replaced or migrated.

### Tasks
- [x] Add Vitest (+ jsdom); `npm test` script; add `@testing-library/react` only when the first component test needs it *(not added — no component tests yet)*
- [x] Extract the existing pure logic (filter predicate, `uniqSorted`, color/`hex` handling, URL param merge) and write **characterization tests** capturing current behavior against real `car-models.json` *(`src/utils/*`, 48 tests)*
- [x] Decide npm vs pnpm; make lockfile + `node_modules` consistent; document in `CLAUDE.md` *(npm; `packageManager` pinned; pnpm/yarn lockfiles git-ignored)*
- [x] Add `.env.example` and typed `import.meta.env` (`src/vite-env.d.ts`) placeholders (no Supabase yet)
- [x] Add a `typecheck` script (`tsc -b --noEmit` equivalent) *(`tsc -b`; both tsconfigs already `noEmit`)*

### Verification
- [x] Tests fail if a filter rule is deliberately broken (mutation sanity check) *(3 mutations: first-color-only match, case-insensitive brand, `All` not deleted from URL — each caught)*
- [x] Fresh clone → install → `build`, `lint`, `test` all pass *(`npm ci` in a clean copy)*

### Notes
- `npm run lint` failed on `main` before this phase (3 × `react-hooks/set-state-in-effect` in `Sidebar` and `CollectionPage`). Fixing them means restructuring the effect-based sync, which is Phase 13/19 work, so they're suppressed line-by-line with a comment naming the phase that removes them.

### Definition of Done
`npm test` runs ≥ 1 meaningful suite covering current filtering behavior; one package manager; app behavior unchanged.

---

## Phase 3 — Design Foundation ✅

### Goal
Centralize all redesign values so no component hard-codes them.

### Tasks
- [x] Extend `src/styles/styles.css` tokens (don't restart): navy/charcoal surfaces, **gold accent** (sampled from mockups), text tiers, borders/hairlines, radii, elevation/shadows, spacing scale, type scale, motion durations/easing *(colors pixel-sampled from `Mockup Overall.png`. Legacy names kept as aliases, so the existing UI already uses the new palette)*
- [x] Interaction-state tokens: hover, focus ring, active, selected, disabled *(plus a global `:focus-visible` ring)*
- [x] Category color tokens `--cat-rally|racing|supercar|premium|retro` (+ fallback) replacing the TSX map; keep them keyed by category **slug** *(`categorySlug()`; legacy truck slugs kept until Phase 11)*
- [x] Breakpoints as one documented source: `mobile < 640`, `tablet 640–1023`, `desktop ≥ 1024`, `wide ≥ 1600` (CSS can't `var()` in `@media`, so add `src/styles/breakpoints.ts` + a comment block, and use them consistently) *(sync enforced by test. Legacy 600/768/1280/1500/1800 queries are converted when those components are rebuilt)*
- [x] Decide typography (Jost vs mockup face) by comparing against mockup; keep `font-display: swap` *(**Nunito Sans**. The mockup has a double-story a, straight M and Avenir-like proportions, and Jost doesn't match)*
- [x] Keep light theme functional with the new token names (no light mockup exists — derived, flagged)
- [x] Small token reference page/section in `docs/` (or a dev-only route) showing every token *(`docs/DESIGN-TOKENS.md` + dev-only `/dev/tokens`, excluded from prod bundle)*

### Verification
- [x] Toggle dark/light: no unstyled or unreadable existing screen *(`/`, `/cars`, modal, `/dev/tokens` checked in both themes; no horizontal overflow at 360/768/1280)*
- [x] `grep` shows no *new* hard-coded hex/px in components *(now a ratchet test: `src/styles/tokens.test.ts`)*
- [x] Contrast of gold-on-navy and each category color on dark surface measured and recorded (≥ 4.5:1 for text or documented exception) *(table in `docs/DESIGN-TOKENS.md`, enforced for both themes by `src/styles/contrast.test.ts`. Racing/Supercar nudged brighter than the mockup to pass)*

### Definition of Done
Tokens exist for every value class above; existing pages look unchanged/acceptable; contrast table recorded.

---

## Phase 4 — Supabase Schema Design (documentation only) 🟡

### Goal
Design the database from the real data and mockups, and document the OLD JSON → NEW mapping. **No database is touched.**

### Tasks
- [x] `docs/SCHEMA.md` with ERD, per-table columns/types/nullability/constraints/indexes
- [x] Proposed tables (validate against the audit; don't over-normalize): *(deviations: no `status` column (owner: all models are owned); `car_number` is `text` so `00`/`07` round-trip; `model_images` uses `storage_path` + `external_url` (= `legacy_url`); added a `model_summaries` view)*
  - `models` — `id uuid`, `slug` unique (**= legacy `id` verbatim**), `name`, `year int`, `brand_id`, `manufacturer_id`, `category_id`, `scale text default '1:43'` (format check; no `scales` table until a 2nd scale exists), `livery_hex text[]`, `is_racing bool`, `car_number int null`, `driver_id null`, `team null`, `event null`, `series null`, `description null`, `key_features text[]`, `status`/`condition`/`location null`, `added_at date null`, `is_published bool default true`, `created_at/updated_at` (+ trigger)
  - `brands`, `manufacturers` — `slug`, `name`, `logo_path`
  - `categories` — `slug`, `name`, `sort_order` (table, not enum: mockup implies categories evolve)
  - `colors` (`name`, `hex`) + `model_colors` (filter colors, 1–3 per model)
  - `drivers` — `slug`, `name`, `country_code null`
  - `model_images` — `model_id`, `url`/`storage_path`, `thumbnail_url`, `position`, `is_primary`, `legacy_url`, `width/height null`
  - `tags` + `model_tags`
  - `model_private_notes` — **separate admin-only table** (RLS is row-level, so private text cannot live on a public row)
  - `admin_users` — owner allow-list used by `is_admin()`
- [x] Indexes: FK columns, `slug`, filter columns, `pg_trgm`/generated `tsvector` for search (justify vs client-side search) *(no search index: client-side search over a list of about 90 KB; revisit in Phase 33)*
- [x] Mapping table for every JSON field, including **decisions for each data-quality finding D1–D14** (driver alias map, MULTI, hex vs color, `is_racing` derivation, `added_at` backfill, `COMING_SOON` dropped, ~~Chevrolet/Corvette left as-is~~ **Corvette merged into Chevrolet** per owner) *(+ new D15: "DTM" manufacturer)*
- [x] Decide logo strategy: keep SVGs in `public/` and store `logo_path` (recommended: no file renames, `encodeURI` at use)
- [x] Decide public vs private for condition/location/added/notes (owner input) *(condition, added, location public; notes private)*

### Verification
- [x] Every JSON key appears in the mapping table (or is explicitly dropped with a reason)
- [x] Every mockup field maps to a column/table (or is explicitly deferred)
- [ ] Owner reviews and approves `docs/SCHEMA.md`

### Definition of Done
Approved schema document; no code or DB changes.

---

## Phase 5 — Supabase Project & Client Integration ✅

### Goal
Connect the app to Supabase without changing any UI.

### Tasks
- [x] Owner creates the Supabase project (region near users); note the free-tier **inactivity pause** risk (revisit in Phase 37) *(`zemaking-diecast-car-collection`, ref `gduqlrdjbhiftwzamtoe`, in the owner's second Supabase account because the main account's 2 free slots are used by recipes and games. All objects go in schema `diecast`)*
- [x] Add `@supabase/supabase-js`; single client in `src/lib/supabase.ts` using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable key)
- [x] `.env.example`; `.env.local` git-ignored (already covered by `*.local`); startup check that fails loudly if env is missing *(`parseSupabaseEnv` throws `EnvError` on import of the client and also rejects secret/service_role keys; the dev server warns in the console. It isn't a hard app failure yet because the UI doesn't use Supabase until Phase 10)*
- [x] Supabase CLI setup (`supabase/` folder, `config.toml`); decide hosted-only vs local Docker for dev *(hosted for dev/prod; local Docker optional for migration testing; sign-ups disabled in config)*
- [x] Type generation script → `src/lib/database.types.ts` (after Phase 6 has tables) *(`npm run db:types`; placeholder file until then)*
- [x] `AppError` type + `toAppError()` normalizer (network vs Postgres vs auth)
- [x] Dev-only connectivity check *(console check in dev + `npm run supabase:check`)*

### Verification
- [x] Client connects (simple `select 1`-style call) from dev server *(`/auth/v1/health` with the anon key: `npm run supabase:check` ✓ and dev console `[supabase] connected`. There are no tables yet for a real select; Phase 6 adds one)*
- [x] Production build contains no `service_role` string and no non-`VITE_` secrets *(enforced on every build by `postbuild` → `scripts/check-bundle-secrets.mjs`)*

### Definition of Done
Client + env + error normalization in place; app UI unchanged; no secrets committed.

---

## Phase 6 — Database Migrations & RLS

### Goal
Create the schema and lock it down.

### Tasks
- [ ] `supabase/migrations/*`: schema per approved Phase 4 doc, `updated_at` trigger, seed lookups (categories)
- [ ] `is_admin()` (`SECURITY DEFINER`, reads `admin_users`); disable public sign-ups in Supabase Auth
- [ ] RLS **enabled on every table**. Public: `SELECT` on published rows / lookups only. Admin: full CRUD. `model_private_notes`, drafts, `admin_users`: admin only
- [ ] `scripts/verify-rls.mjs` — runs as anon and as a non-admin authenticated user and asserts denials
- [ ] Generate `database.types.ts`

### Verification
- [ ] Anon: can read published models; **cannot** insert/update/delete anywhere; cannot see drafts, private notes or `admin_users`
- [ ] Authenticated non-admin: same as anon
- [ ] Admin: can CRUD
- [ ] `supabase db push` on a clean project reproduces the schema from migrations alone

### Definition of Done
RLS enabled on all tables, verification script green, migrations reproducible.

**Manual:** run `supabase db push`; create the owner user; insert the owner into `admin_users`.

---

## Phase 7 — JSON → Supabase Import Tool

### Goal
A repeatable, idempotent importer — no hand-inserting rows.

### Tasks
- [ ] `scripts/import/` (add `tsx` as dev dep if needed); reads **`car-models.json` only** (trucks explicitly skipped)
- [ ] Reviewed alias map for drivers (D5) and any other normalizations, kept in a versioned file
- [ ] Upsert by `slug`; `--dry-run`; safe to re-run; per-table transaction
- [ ] Derives `is_racing`, `model_colors`, `livery_hex`, `scale = '1:43'`; drops `COMING_SOON`
- [ ] Backfills `added_at` for the ~23 models datable from git; others `NULL` (one-off `scripts/import/added-dates.json`)
- [ ] Image rows reference the **existing postimg URLs** unchanged (thumbnail + full)
- [ ] Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`/shell only
- [ ] Console summary, e.g. `Imported models: 227 · manufacturers: 19 · brands: 45 · categories: 5 · colors: 13 · drivers: 138 · model_colors: 244 · images: 227 · Warnings: N · Failed: 0` (expected counts: `docs/SCHEMA.md` §6.4), warnings itemized (D3, D7, drivers without country, …)

### Verification
- [ ] Dry-run makes zero writes
- [ ] Run twice → second run reports 0 inserts, 0 changes
- [ ] Failure injected mid-run leaves no partial table state

### Definition of Done
One command imports all 227 models with a clear report and zero failures.

---

## Phase 8 — Migration Verification

### Goal
Prove Supabase matches the JSON before anything depends on it.

### Tasks
- [ ] `scripts/verify-migration.mjs` compares JSON ↔ DB per model: name, year, brand, manufacturer, category, color names, `livery_hex` order, scale, driver (post-alias), car number, image URLs, slug
- [ ] Aggregate checks: 227 models, 45 brands (Corvette merged), 19 manufacturers, 5 categories, 13 colors, driver count matches alias map
- [ ] Duplicate-slug and orphan-FK checks; models without images/brand/manufacturer/category
- [ ] HEAD-check all 454 image URLs (with retry; report failures, don't fail the build on transient errors)
- [ ] Write `docs/migration-report.md`

### Verification
- [ ] Report shows 0 mismatches, 0 orphans, 0 duplicates
- [ ] Owner spot-checks ~10 models in the Supabase dashboard

### Definition of Done
Signed-off report. **Do not start Phase 9 until this is approved.**

---

## Phase 9 — Data Access Layer

### Goal
Clean services so components never query Supabase directly.

### Tasks
- [ ] Domain types (`Model`, `ModelSummary`, `Brand`, `Manufacturer`, `Category`, `Driver`, `ModelImage`) + row→domain mappers
- [ ] `src/services/`: `getModels()` (summary columns), `getModelBySlug()`, `getManufacturers()`, `getBrands()`, `getCategories()`, `getColors()`, `getCollectionStats()`, `getRecentlyAddedModels()`, `searchModels()`
- [ ] Pure `collection-query` module: filter (multi-value), search (diacritic-insensitive), sort, facet counts — built on the Phase 2 characterization tests
- [ ] Caching/loading approach; decide TanStack Query vs a small hook (recommend TanStack Query: caching, retry, loading/error states; justify)
- [ ] ESLint `no-restricted-imports` blocking `@supabase/supabase-js` outside `src/lib` and `src/services`
- [ ] Unit tests with a mocked client + fixtures (`car-models.json`-derived)

### Verification
- [ ] Services return the full 227-model set with identical field values to Phase 8
- [ ] Lint fails if a component imports Supabase directly

### Definition of Done
Services + pure query module tested; UI still on JSON (no user-visible change).

---

## Phase 10 — Cars Read from Supabase

### Goal
Switch the existing UI's car data to Supabase and prove functional parity.

### Tasks
- [ ] `CollectionPage` (type `cars`) reads through services; add minimal loading + error rendering (consolidated in Phase 29)
- [ ] Map domain model → existing card/modal props (keep old UI intact)
- [ ] Trucks still read JSON in this phase (removed in Phase 11)
- [ ] Parity checklist run in the browser: card count, each filter, URL params, `?model=` deep link, modal fields

### Verification
- [ ] 227 cards, identical filter results for every brand/manufacturer/category/color vs JSON baseline (scripted comparison)
- [ ] Network tab: no `car-models.json` request/bundle import on `/cars`
- [ ] Error path: kill network → error state, not blank page

### Definition of Done
Cars are Supabase-backed with verified parity; rollback = `git revert` (JSON untouched).

---

## Phase 11 — Retire Trucks & Runtime JSON

### Goal
Remove trucks from the product and eliminate all runtime JSON imports.

### Tasks
- [ ] Remove `/trucks` route, landing page, `trucks-logo.png` usage; `/` renders the collection; `/cars` and `/trucks` redirect to `/` **preserving query params** (so old `?model=`/filter links keep working)
- [ ] Move `truck-models.json` (and keep `car-models.json`) to `archive/legacy-data/` — not bundled, not imported
- [ ] Confirm zero `*.json` imports under `src/`
- [ ] Update `CLAUDE.md` (no trucks, data source is Supabase)

### Verification
- [ ] `grep -r "\.json" src` shows no data imports; bundle contains no model data
- [ ] Old links `/cars?model=<id>`, `/cars?brand=Ford`, `/trucks` all land somewhere sensible

### Definition of Done
Production reads only Supabase; archives preserved; trucks gone from UI.

**Manual:** confirm the 39 trucks are intentionally excluded from Supabase (archived JSON only).

---

## Phase 12 — Application Shell & Routing

### Goal
The redesigned header, navigation, page container and route table.

### Tasks
- [ ] Route table: `/`, `/models/:slug`, `/manufacturers`, `/manufacturers/:slug`, `/brands`, `/brands/:slug`, `/statistics`, `/about`, `/login`, `/admin/models/new`, `/admin/models/:slug/edit`, 404 page. **Nav only links to pages that exist**; `?model=` modal still works until Phase 19
- [ ] Header per mockup: logo, nav, search entry (wired in Phase 15), live "N models" from `getCollectionStats()`, theme toggle, Instagram, email, avatar slot (Phase 24)
- [ ] Responsive nav (hamburger → drawer) — desktop first, usable at 360 px
- [ ] Page container/max-width/spacing from tokens; scroll-to-top retained
- [ ] Optimize the logo (687 KB PNG → SVG/WebP); About page (content from owner)
- [ ] Footer/socials if in the final design

### Verification
- [ ] Every nav link resolves; unknown URL → 404 page; refresh on any route works (Vercel rewrite)
- [ ] Model count matches DB; keyboard-only nav works

### Definition of Done
New shell live on all routes with real data; old content areas temporarily inside it.

---

## Phase 13 — Collection Toolbar & URL State

### Goal
Replace the sidebar with the toolbar; make the URL the single source of truth for filters.

### Tasks
- [ ] `useCollectionQuery()` hook: parse/serialize `brand`, `manufacturer`, `category`, `color`, (later `q`, `sort`) from `useSearchParams` — **no mirrored local state, no sync effects**
- [ ] Multi-value filters via repeated params; **legacy single-value/display-name URLs (`brand=Citroën`) still parse**; canonical form uses slugs
- [ ] Toolbar: Filters button (+active count), Brand / Manufacturer / Category / Color triggers, results count
- [ ] Active filter **chips** (`Ixo ×`) and **Clear all**; placeholders for view toggle and Sort (wired in 15/18)
- [ ] Delete `Sidebar`

### Verification
- [ ] Unit tests: parse/serialize round-trip, legacy URLs, unknown values ignored safely
- [ ] Back/forward and shared URLs reproduce the same filtered view; changing a filter never clobbers `q`/`sort`/other params

### Definition of Done
Shareable filtered URLs; sidebar gone; no effect-based state sync remains.

---

## Phase 14 — Advanced Filter Experience

### Goal
The rich filter panel from the mockup.

### Tasks
- [ ] Filter panel component: desktop/tablet popover/side panel, **mobile bottom sheet/drawer** (same content)
- [ ] Manufacturer: searchable checkbox list with counts and selected state; Brand: searchable; Category: pills (colors from tokens); Color: **swatches** (Multi as conic); Scale: hidden until >1 scale exists
- [ ] Facet counts computed from the loaded list against the *other* active filters
- [ ] Apply/Clear/Close, focus management, Esc closes

### Verification
- [ ] Counts correct against a scripted count (e.g. Ixo = 29, Rally = 98 with no other filters)
- [ ] Works at 360 / 768 / 1280; keyboard operable

### Definition of Done
All four filters usable on all sizes with counts; matches the mockup panel (categories/data from the DB, not the mockup's sample "Road/Classic").

---

## Phase 15 — Search & Sorting

### Goal
Collection-wide search and useful sorting.

### Tasks
- [ ] Search box (header entry + toolbar) → `?q=`; 250 ms debounce; clear button; loading + no-results state
- [ ] Fields: name, brand, manufacturer, year, category, driver, car number; **diacritic-insensitive** (`citroen` finds Citroën, `skoda` finds Škoda); ranking: name-prefix > name-contains > other fields
- [ ] Sort options from real data: Recently added, Oldest added, Model A–Z / Z–A, Year newest/oldest, Manufacturer, Brand → `?sort=`
- [ ] Stable tie-breaker (204 models share one added date) so order never flickers
- [ ] "Recently added" behavior for `added_at IS NULL` documented (NULL last, then by name)

### Verification
- [ ] Unit tests for normalization, ranking, every sort, NULL `added_at`
- [ ] Search + filters + sort combine correctly and survive refresh

### Definition of Done
Search and sort work, are URL-persisted, and are covered by tests.

---

## Phase 16 — Model Card Redesign

### Goal
Photography-first card per the mockup.

### Tasks
- [ ] Card layout: image primary; manufacturer logo (top-left), scale badge (top-right); car number + driver pill (bottom) **only when present**; title + color dot(s); meta row brand logo · year · manufacturer · category (token color)
- [ ] Racing info handles any combination (number only, driver only, both, neither — audit D7)
- [ ] States: default, hover, focus-visible, loading skeleton; whole card is a real link/button (fixes the non-focusable card)
- [ ] `ColorCircle` restyled and reused; drop nested borders
- [ ] Logo URLs via `logo_path` with `encodeURI`; image fallback hook (final visuals in Phase 29)

### Verification
- [ ] Visual check vs mockup at 1440; a road car shows no racing UI; a number-only model (Mazda RX-7 FD) renders sensibly
- [ ] Tab/Enter opens the model

### Definition of Done
New card used everywhere the old one was; old `ModelCard` styles removed.

---

## Phase 17 — Collection Hero & Grid

### Goal
Intro area and responsive grid per the mockups.

### Tasks
- [ ] Hero: eyebrow "MY COLLECTION", **count from data**, subtitle, tagline (fix the mockup's "Diecas" typo), background art (asset from owner)
- [ ] Grid: mockup targets — desktop ~5, tablet 3, mobile 1 (confirm against final mockups; prefer `auto-fill/minmax` if it reproduces them)
- [ ] Remove `.thumb { min-width: 250px }` and other forced widths
- [ ] Results header (count, active state) between toolbar and grid

### Verification
- [ ] 227 (or filtered) cards render; counts match; columns at 360/768/1024/1440/1920
- [ ] No layout shift when images load (aspect ratio reserved)

### Definition of Done
Hero + grid match the Desktop mockup; usable on narrow widths.

---

## Phase 18 — Alternative Collection Views

### Goal
View modes defined by the mockup toolbar.

### Tasks
- [ ] Grid (default), List, Compact (the three toolbar icons); each reuses card data
- [ ] Persist choice in `localStorage` (guarded), not in the URL
- [ ] **Showcase** carousel view is "optional" in the mockup — decide at phase start (build or defer)

### Verification
- [ ] Switching preserves filters/search/sort/scroll sensibly; refresh keeps the mode
- [ ] Each mode usable at 360 px

### Definition of Done
Approved view modes implemented and persisted; Showcase built or explicitly deferred.

---

## Phase 19 — Model Details Page

### Goal
A collector-catalogue page at `/models/:slug`.

### Tasks
- [ ] Layout per mockup: breadcrumb (`Collection › Brand › Model`; model-line level only if the owner wants it and data exists), header (brand logo, title, year · manufacturer · scale · category), six spec tiles, tabs (*Overview / Specifications / Gallery / My Collection / Notes*)
- [ ] **Sections/tabs render only when they have data** (no fabricated description/tags/features)
- [ ] Racing information shown only for racing models; "My Collection" shows only the public fields chosen in Phase 4
- [ ] Back-to-collection preserves previous filters; unknown slug → 404
- [ ] Legacy redirect: `/?model=<id>` (and `/cars?model=`) → `/models/<id>`; remove scroll-then-open timeout logic
- [ ] Admin buttons (Edit/Delete/…) placeholders wired in Phase 24/25

### Verification
- [ ] Deep link + refresh works; old shared links redirect; tab state survives refresh
- [ ] A model with no extra data looks intentional, not empty

### Definition of Done
Details page replaces the modal deep-link path with parity of information.

---

## Phase 20 — Gallery, Lightbox & Quick View

### Goal
Great photography experience; replaces `DetailsModal`.

### Tasks
- [ ] Gallery from `model_images`: primary, thumbnails, prev/next, `1 / n` counter (degrades gracefully to the single image all models have today)
- [ ] Lightbox: fullscreen, `←/→/Esc`, touch swipe (pointer events, no library), neighbor preloading, loading skeleton, missing-image fallback
- [ ] Quick View modal from cards (native `<dialog>` with focus trap/restore) — confirm it stays given the details page
- [ ] Storage-ready image URL resolver (postimg now, Storage in Phase 21)

### Verification
- [ ] Keyboard-only and touch flows work; focus returns to the trigger
- [ ] Old `DetailsModal` no longer referenced

### Definition of Done
Gallery + lightbox + Quick View shipped; `DetailsModal` deleted or unreferenced.

---

## Phase 21 — Supabase Storage Migration

### Goal
Move images off postimg.cc into Supabase Storage safely.

### Tasks
- [ ] Bucket `model-images`: public read, admin-only write policies; path scheme `models/{slug}/{position}-{full|thumb}.webp|png`
- [ ] Resumable migration script with **retries** (audit saw transient fetch failures), checksums, `--dry-run`, skip-already-done
- [ ] Keep `legacy_url` on `model_images` until verification; flip to `storage_path` only after checks
- [ ] Thumbnails: check if Storage image transformations are available on the plan; otherwise generate at import (and at upload in Phase 27)
- [ ] Verify total size fits the plan (est. ~230 MB); no base64 in Postgres

### Verification
- [ ] Every image row resolves (HEAD 200); byte/dimension spot checks; page renders with Storage URLs
- [ ] Rollback path documented (`legacy_url` still valid)

### Definition of Done
All 227 models' images served from Storage; postimg URLs retained only as `legacy_url`.

**Manual:** run the migration script locally with the service-role key.

---

## Phase 22 — Manufacturer & Brand Browsing

### Goal
Browse the collection by manufacturer and by brand.

### Tasks
- [ ] Index pages (`/manufacturers`, `/brands`): logo, name, model count
- [ ] Detail pages (`/manufacturers/:slug`, `/brands/:slug`): logo, count, categories represented, model grid reusing the card + collection query
- [ ] Shared components for both (same pattern, different data)
- [ ] Links from cards, details spec tiles and filter panel

### Verification
- [ ] Counts match filter-panel counts; Altaya = 130, Ixo = 29, Ford = 22
- [ ] Unknown slug → 404; logos with accents/spaces load

### Definition of Done
Both browse experiences live; nav entries enabled. **Needs mockups** (none supplied).

---

## Phase 23 — Collection Statistics

### Goal
Useful, data-driven statistics in the premium style.

### Tasks
- [ ] Computed from the cached collection / a DB view — **nothing hard-coded**
- [ ] Totals (models, manufacturers, brands, categories); top brand / manufacturer; models by decade (1960s–2020s); racing vs road (via `is_racing`); color distribution with real swatches
- [ ] Skip meaningless charts; choose chart form per the dataviz guidance (simple bars/tiles)

### Verification
- [ ] Every number cross-checked with a SQL query
- [ ] Updates automatically after a model is added

### Definition of Done
Statistics page accurate, responsive, accessible (labels/tables for chart data). **Needs a mockup.**

---

## Phase 24 — Authentication & Admin Protection

### Goal
Owner sign-in; admin actions gated.

### Tasks
- [ ] Supabase Auth (email+password or magic link — owner's choice), sign-ups disabled
- [ ] `useSession`, `/login`, sign-out, avatar menu ("ZK"), `AdminRoute` guard for `/admin/*`
- [ ] Admin-only affordances (Edit / Delete / "…" / Add Model) rendered only for admins — **UI hiding is convenience; RLS is the real gate**
- [ ] Public browsing never requires auth

### Verification
- [ ] Logged-out: admin routes redirect to login; no admin UI
- [ ] Non-admin authenticated user can sign in but every write is rejected by RLS (test)
- [ ] Session persists across refresh; token never in URL

### Definition of Done
Admin gating works end-to-end and is proven by RLS tests.

---

## Phase 25 — Model Form: Core & CRUD

### Goal
Add/Edit/Delete a model without touching JSON.

### Tasks
- [ ] `/admin/models/new`, `/admin/models/:slug/edit` per the Create/Edit mockup: sections *Basic Information, Classification, Racing Information (toggle), Condition & Collection*
- [ ] Accessible searchable **combobox** for brand / manufacturer / driver / color (evaluate Radix/Headless UI vs hand-built; justify)
- [ ] Validation (recommend `react-hook-form` + `zod`; justify); required fields per mockup
- [ ] Slug generated with the existing `brand-model-year-manufacturer-color` convention (diacritics stripped), collision-checked, **stable after creation**
- [ ] Save Model, Save as Draft (`is_published=false`), Cancel with unsaved-changes guard; Delete with confirmation
- [ ] Racing fields shown only for racing models; `model_colors` + `livery_hex` editing
- [ ] Update `CLAUDE.md`: the "add a model" workflow is now the admin UI

### Verification
- [ ] Create → appears on collection; Edit → reflected; Delete → gone (and gone from stats/counts)
- [ ] Duplicate slug rejected with a clear message; draft invisible to anon (RLS test)
- [ ] Round-trip: editing an imported model changes nothing it shouldn't

### Definition of Done
Full CRUD for core fields, validated and RLS-safe.

---

## Phase 26 — Model Form: Rich Sections

### Goal
Description, notes, tags, live preview, checklist.

### Tasks
- [ ] Description editor — **decision:** plain text / markdown-lite (recommended: no WYSIWYG dependency or HTML-sanitization surface) vs rich text per mockup toolbar
- [ ] Private notes (writes to `model_private_notes`, admin-only), key features list, tags (autocomplete + create)
- [ ] **Live Preview** reuses the real `ModelCard`; completeness checklist (name, brand, manufacturer, year, category, scale, color, main image, description-recommended)

### Verification
- [ ] Private notes never appear in any anon query (RLS test)
- [ ] Any rich text is sanitized/escaped on render (XSS test string)

### Definition of Done
Form matches the mockup's seven sections plus preview/checklist.

---

## Phase 27 — Image Management CRUD

### Goal
Upload, order and remove photos safely.

### Tasks
- [ ] Upload (drag/drop, PNG/JPG/WEBP, size cap per mockup), client-side resize + thumbnail generation, progress, error handling
- [ ] Delete with confirmation; removes the Storage object and row; no orphans
- [ ] Reorder (drag **and** keyboard/button alternative); choose primary; preview; max count per mockup (10)
- [ ] Storage + table policies tested (anon/non-admin denied)

### Verification
- [ ] Upload → visible in gallery/card; delete → 404 in Storage; reorder persists
- [ ] Cannot leave a published model with no primary image without a warning

### Definition of Done
Owner can fully manage a model's images from the UI.

---

## Phase 28 — Supporting Data Management

### Goal
Only as much admin as the form needs.

### Tasks
- [ ] Quick-create dialogs from the form for manufacturer, brand (logo choose/upload), driver, tag, color
- [ ] One simple list/rename page for lookups; deletion blocked while in use (FK `RESTRICT`); driver merge tool for the alias-cleanup case
- [ ] No general CMS

### Verification
- [ ] Adding a model with a brand-new brand needs no SQL or file edits
- [ ] Renaming a manufacturer updates all its models' display

### Definition of Done
The "New Car" workflow needs zero developer steps.

---

## Phase 29 — Loading / Empty / Error States

### Goal
One consistent state vocabulary.

### Tasks
- [ ] `Skeleton`, `EmptyState`, `ErrorState` (with retry) components from tokens
- [ ] Cover: collection loading, details loading, no models, no search results, no filter results, missing image (use the `COMING_SOON` placeholder idea as a **local** asset), Supabase failure, offline/network failure, paused project message
- [ ] Error boundary at route level

### Verification
- [ ] Each state reproduced (throttle/offline/mock failures) and screenshotted
- [ ] No blank screens anywhere

### Definition of Done
All listed states implemented and reachable.

---

## Phase 30 — Desktop Fidelity Pass

### Goal
Verify the built product against the Desktop mockups.

### Tasks
- [ ] Side-by-side review at 1440 and 1920: header, hero, toolbar, grid, cards, details, gallery, Create/Edit
- [ ] Fix spacing/typography/hierarchy drift; list any *approved* deviations

### Verification
- [ ] Screenshot set attached per screen; deviations documented

### Definition of Done
Owner accepts desktop visuals.

---

## Phase 31 — Tablet Responsive Pass

### Goal
Designed-for-tablet, not shrunken desktop.

### Tasks
- [ ] Use the **Tablet mockups** (to be supplied): navigation, columns (3 in inset), toolbar wrapping, filter presentation, gallery/detail layout, form layout, touch targets ≥ 44 px
- [ ] Remove `overflow-x: hidden` from `html, body` and fix any real overflow it was hiding

### Verification
- [ ] 768 and 1024, portrait/landscape; no horizontal scroll; touch-only flows work

### Definition of Done
Tablet matches its mockups.

---

## Phase 32 — Mobile Responsive Pass

### Goal
Intentional mobile UX.

### Tasks
- [ ] Use the **Mobile mockups** (to be supplied): hamburger nav, search row, "Filters (n)" + Sort, filter bottom sheet, 1-column cards, details, gallery swipe, forms, dialogs
- [ ] Touch targets ≥ 44 px, safe-area insets, no hover-only affordances, no horizontal scroll

### Verification
- [ ] 360 / 390 / 430 px; real device or emulation; one-thumb reachability of primary actions

### Definition of Done
Mobile matches its mockups; every flow (browse, filter, view, admin add/edit) completes on a phone.

---

## Phase 33 — Performance

### Goal
Measure, then optimize.

### Tasks
- [ ] Baseline first: Lighthouse/Web Vitals, bundle analysis, payload of `getModels()`
- [ ] Image sizing (`width/height`, `srcset`/thumb usage), `fetchpriority` for first row, lazy elsewhere
- [ ] Query payload (select only summary columns), DB indexes checked with `EXPLAIN`, caching
- [ ] Decide on pagination/infinite scroll from measurements (not assumptions); memoization only where profiler shows cost

### Verification
- [ ] Before/after numbers recorded in `docs/performance.md`

### Definition of Done
Targets met or consciously accepted (e.g. LCP, CLS, JS size), documented.

---

## Phase 34 — Accessibility

### Goal
Keyboard, screen-reader and contrast correctness.

### Tasks
- [ ] Keyboard paths for every flow; visible focus; focus trap/restore in dialogs, drawers, lightbox
- [ ] Semantics/labels for icon buttons, filters, chips, tabs; `aria-live` for result counts
- [ ] Contrast audit (gold, category colors, muted text on navy — known risk: Racing red / Supercar blue text on dark)
- [ ] `prefers-reduced-motion`; touch target sizes

### Verification
- [ ] axe (manual now, automated in Phase 35); keyboard-only run-through; screen-reader spot check

### Definition of Done
No critical/serious axe violations; documented exceptions only.

---

## Phase 35 — End-to-End Testing

### Goal
Protect the major journeys.

### Tasks
- [ ] Playwright; **separate test Supabase project** (never run write tests against production data); seeded via the import tool
- [ ] Journeys: browse/filter/search/sort + deep links; details + gallery; login → create → edit → upload image → delete; RLS denial checks; 404s; mobile viewport smoke
- [ ] `@axe-core/playwright` on key pages
- [ ] Extend unit/component tests: services, query state, forms, auth guard

### Verification
- [ ] Suite green locally and repeatable; failures produce traces

### Definition of Done
`npm run test:e2e` covers all major journeys.

---

## Phase 36 — Legacy Cleanup

### Goal
Remove what the redesign made obsolete — only after everything is verified.

### Tasks
- [ ] Remove old components/styles (`Sidebar`, `DetailsModal`, `landing-page`, `countPill` remnants, `CategoryLabel` map), old `types.ts`, dead CSS, unused truck-only brand SVGs, unused deps
- [ ] Rewrite `CLAUDE.md` and `README.md` (Supabase, admin workflow, env, scripts)
- [ ] **Keep** `archive/legacy-data/*.json` and import/verify scripts until explicitly approved

### Verification
- [ ] Build/lint/tests/E2E green; bundle smaller; no unreferenced assets

### Definition of Done
No dead code; docs match reality; archives intact.

---

## Phase 37 — Production Verification

### Goal
Confirm the live site against Supabase across devices.

### Tasks
- [ ] Vercel env vars set; preview deploy verified before promoting to production
- [ ] Checklist on Desktop / Tablet / Mobile: collection load, search, filters, sort, details, gallery, login, create, edit, delete, image upload, direct URLs + refresh, 404
- [ ] Re-run `verify-rls.mjs` against production with the anon key; confirm no service-role key in the built bundle
- [ ] **Free-tier pause mitigation** (paid plan or scheduled keep-alive), backups/export routine, rollback plan (previous Vercel deploy + JSON archive)
- [ ] Clean up any throwaway records created during testing

### Verification
- [ ] Signed checklist in `docs/production-verification.md`

### Definition of Done
Owner go/no-go recorded; site stable on Supabase.

---

## Open decisions / inputs needed

| # | Question | Needed by |
| --- | --- | --- |
| 1 | **Tablet & Mobile mockups**: the supplied images only include small insets of the collection page. Please provide full-page Tablet and Mobile references (collection, filter sheet, details, add/edit), ideally as separate images per device | Ph 14 (filter sheet), 31, 32 |
| 2 | **No mockups exist** for Manufacturers, Brands, Statistics, About, Login. Generate them, or should I design them from the established system? | Ph 22, 23, 24 |
| 3 | **Light theme**: keep (derived from tokens, no mockup) or dark-only? *Phase 3 kept it, with derived values that pass contrast. Confirm, or say dark-only* | Ph 3 |
| 4 | ~~Confirm trucks are excluded~~ → excluded; schema has no truck data (Phase 4) | Ph 4 / 11 |
| 5 | ~~Public "My Collection" fields~~ → condition, added, location **public**; notes private; **no collected/status field** (all owned) (Phase 4) | Ph 4 |
| 6 | Description editor: rich text (WYSIWYG) vs plain/markdown-lite | Ph 26 |
| 7 | Heart / "Add to Collection" — what should they mean on a single-owner site? Breadcrumb "model line" level — wanted? | Ph 19 / 20 |
| 8 | ~~Corvette / scale~~ → **merge Corvette into Chevrolet**; **all 227 are 1:43** (Phase 4) | Ph 4 / 7 |
| 9 | ~~npm or pnpm~~ → **npm** (decided in Phase 2) | Ph 2 |
| 10 | Supabase plan (free projects pause after inactivity) — pay, or keep-alive ping? *Project is on the free plan (second account); decide before launch* | Ph 5 / 37 |
| 11 | Assets: header logo (SVG preferred), hero background image | Ph 12, 17 |
| 12 | **D15**: manufacturer "DTM" (3 BMW/Mercedes models) is a race series, not a model maker. Keep, or give the real manufacturers? | Ph 7 |
