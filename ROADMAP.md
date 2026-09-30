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
| 6 | Migrations & RLS | ✅ Done | — |
| 7 | JSON → Supabase Import Tool | ✅ Done | — |
| 8 | Migration Verification | ✅ Done | — |
| 9 | Data Access Layer | ✅ Done | — |
| 10 | Cars Read from Supabase | ✅ Done | — |
| 11 | Retire Trucks & Runtime JSON | ✅ Done | — |
| 12 | Application Shell & Routing | ✅ Done | — |
| 13 | Collection Toolbar & URL State | ✅ Done | — |
| 14 | Advanced Filter Panel | ✅ Done | — |
| 15 | Search & Sorting | ✅ Done | — |
| 16 | Model Card Redesign | ✅ Done | — |
| 17 | Collection Hero & Grid | ✅ Done | Hero background image (optional — slot ready) |
| 18 | View Modes | ✅ Done | — (Showcase deferred by owner) |
| 19 | Model Details Page | ✅ Done | Heart / "Add to Collection" meaning (open decision 7) |
| 20 | Gallery, Lightbox & Quick View | ✅ Done | — |
| 21 | Supabase Storage Migration | 🟡 Tooling done, awaiting owner run | Apply migration `20260930120000`; run upload → flip → verify (`scripts/migrate-images/README.md`) |
| 22 | Manufacturer & Brand Browsing | ✅ Done | Review the design (no mockup existed — built from the established system) |
| 23 | Collection Statistics | ✅ Done | Review the design (no mockup existed — built from the established system) |
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

## Phase 6 — Database Migrations & RLS ✅

### Goal
Create the schema and lock it down.

### Tasks
- [x] `supabase/migrations/*`: schema per approved Phase 4 doc, `updated_at` trigger, seed lookups (categories) *(3 files in schema `diecast`, incl. the `model_summaries` view with `security_invoker`. Applied by the owner in the dashboard SQL editor, not `db push`; see `docs/SUPABASE-SETUP.md`)*
- [x] `is_admin()` (`SECURITY DEFINER`, reads `admin_users`); disable public sign-ups in Supabase Auth *(sign-ups disabled in the dashboard; owner confirmed 2026-09-27)*
- [x] RLS **enabled on every table**. Public: `SELECT` on published rows / lookups only. Admin: full CRUD. `model_private_notes`, drafts, `admin_users`: admin only *(plus: anon has no grant at all on the two private tables; `admin_users` isn't writable through the API even by admins)*
- [x] `scripts/verify-rls.mjs` — runs as anon and as a non-admin authenticated user and asserts denials *(`npm run verify:rls`, 63 checks, incl. admin CRUD, with self-cleaning fixtures)*
- [x] Generate `database.types.ts` *(hand-written in generator format since the CLI isn't linked; `npm run verify:types` checks all 13 relations against the live DB, plus compile-time tests)*

### Verification
- [x] Anon: can read published models; **cannot** insert/update/delete anywhere; cannot see drafts, private notes or `admin_users`
- [x] Authenticated non-admin: same as anon
- [x] Admin: can CRUD
- [ ] `supabase db push` on a clean project reproduces the schema from migrations alone *(**not yet proven**: the owner chose to skip the local Docker run. The files did apply cleanly, in order, to an empty project. A repeat run on the Phase 35 test project closes this)*

### Definition of Done
RLS enabled on all tables, verification script green, migrations reproducible.

**Manual:** run `supabase db push`; create the owner user; insert the owner into `admin_users`. *(Done via SQL editor 2026-09-27: 3 migrations applied, `diecast` exposed, owner + non-admin test user created, owner in `admin_users`.)*

---

## Phase 7 — JSON → Supabase Import Tool ✅

### Goal
A repeatable, idempotent importer — no hand-inserting rows.

### Tasks
- [x] `scripts/import/` (add `tsx` as dev dep if needed); reads **`car-models.json` only** (trucks explicitly skipped)
- [x] Reviewed alias map for drivers (D5) and any other normalizations, kept in a versioned file *(`driver-aliases.json`, `lookups.json`)*
- [x] Upsert by `slug`; `--dry-run`; safe to re-run; per-table transaction *(stronger: **one** transaction for the whole import via `diecast.import_collection()`; dry run is the default and `--apply` is required to write)*
- [x] Derives `is_racing`, `model_colors`, `livery_hex`, `scale = '1:43'`; drops `COMING_SOON`
- [x] Backfills `added_at` for the ~23 models datable from git; others `NULL` (one-off `scripts/import/added-dates.json`) *(actually **67**: the audit missed a rename of the data file. Id renames are followed; the 160 catalogued on day one stay NULL)*
- [x] Image rows reference the **existing postimg URLs** unchanged (thumbnail + full)
- [x] Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`/shell only *(rejects any non-service-role key)*
- [x] Console summary, e.g. `Imported models: 227 · manufacturers: 19 · brands: 45 · categories: 5 · colors: 13 · drivers: 138 · model_colors: 244 · images: 227 · Warnings: N · Failed: 0` (expected counts: `docs/SCHEMA.md` §6.4), warnings itemized (D3, D7, drivers without country, …) *(plus a per-table inserted/updated/deleted table)*

### Verification
- [x] Dry-run makes zero writes *(all tables still 0 after the dry run)*
- [x] Run twice → second run reports 0 inserts, 0 changes *(913 changes, then 0)*
- [x] Failure injected mid-run leaves no partial table state *(`--apply --fail-after=models`: all tables still 0)*

### Definition of Done
One command imports all 227 models with a clear report and zero failures.

---

## Phase 8 — Migration Verification ✅

### Goal
Prove Supabase matches the JSON before anything depends on it.

### Tasks
- [x] `scripts/verify-migration.ts` compares JSON ↔ DB per model: name, year, brand, manufacturer, category, color slugs (+ order), `livery_hex` order, scale, driver (post-alias), car number, image URLs, slug *(reuses the importer's own `loadImportInputs`/`buildImport` as the expected side — one transform, two consumers — and reads `diecast.model_summaries` with the anon key, i.e. the same access a signed-out visitor has)*
- [x] Aggregate checks: 227 models, 45 brands (Corvette merged), 19 manufacturers, 5 categories, 13 colors, driver count matches alias map *(all ✅ — see table below)*
- [x] Duplicate-slug and orphan-FK checks; models without images/brand/manufacturer/category *(all ✅ none found; brand/manufacturer/category are enforced NOT NULL FKs so those three are structurally impossible, checked anyway)*
- [x] HEAD-check all 454 image URLs (with retry; report failures, don't fail the build on transient errors) *(1 retry, 6 s timeout, concurrency 24; 453/454 OK on first full run — the 1 failure was a `postimg.cc` timeout, confirmed reachable (200) moments later by hand; informational only, doesn't fail the script)*
- [x] Write `docs/migration-report.md`

### Verification
- [x] Report shows 0 mismatches, 0 orphans, 0 duplicates
- [x] Owner spot-checks ~10 models in the Supabase dashboard *(confirmed 2026-09-29)*

### Definition of Done
Signed-off report. **Do not start Phase 9 until this is approved.**

---

## Phase 9 — Data Access Layer ✅

### Goal
Clean services so components never query Supabase directly.

### Tasks
- [x] Domain types (`Model`, `ModelSummary`, `Brand`/`Manufacturer` → `LookupRef`, `Category`, `Driver`, `ModelImage`) + row→domain mappers *(`src/services/types.ts`, `src/services/mappers.ts`. `Brand`/`Manufacturer` share one `LookupRef` shape — both are `{slug, name, logoPath}` with nothing else to distinguish, so a separate type each would just be a rename)*
- [x] `src/services/`: `getModels()` (summary columns), `getModelBySlug()`, `getManufacturers()`, `getBrands()`, `getCategories()`, `getColors()`, `getCollectionStats()`, `getRecentlyAddedModels()`, `searchModels()` *(`models.ts`, `lookups.ts`, `stats.ts`; `searchModels()` lives in `collection-query.ts` and is re-exported through the `src/services` barrel (`index.ts`) — it's pure client-side logic per the read strategy, not a network call, so it belongs with filter/sort/facets, not beside the Supabase-calling functions)*
- [x] Pure `collection-query` module: filter (multi-value), search (diacritic-insensitive), sort, facet counts *(`collection-query.ts` — `filterModels`/`searchModels`/`sortModels`/`getFacetCounts`, tested against fixtures derived from `car-models.json`, incl. the known Ixo=29/Altaya=130/Ford=22/Rally=98 counts cited elsewhere in this roadmap)*
- [x] Caching/loading approach: **TanStack Query**, justified below *(`@supabase/supabase-js` dep bump aside, one new dependency: `@tanstack/react-query`. Justification: services already throw a typed `AppError` on failure — TanStack Query's `isPending`/`isError`/`error`/`refetch` map onto that directly with no hand-rolled `useEffect` + local state per call, and its cache is exactly the "load the summary list once" the ROADMAP architecture asks for. `QueryClientProvider` is wired in `main.tsx` now (infrastructure only — no component calls `useQuery` yet, so this is not a user-visible change); Phase 10 is the first consumer)*
- [x] ESLint `no-restricted-imports` blocking `@supabase/supabase-js` outside `src/lib` and `src/services` *(`eslint.config.js`; verified live — see Verification)*
- [x] Unit tests with a mocked client + fixtures (`car-models.json`-derived) *(`src/services/*.test.ts`, 381 tests total across the repo; fixtures in `fixtures.test-data.ts`, mock Supabase chain in `chainable.test-data.ts` — both named `*.test-data.ts`, not `*.test.ts`, so Vitest doesn't try to run them as suites)*

### Verification
- [x] Services return the full 227-model set with identical field values to Phase 8 *(ran `getModels()` live against Supabase with the anon key: 227 models, 45 brands, 19 manufacturers, 5 categories — matches `docs/migration-report.md` exactly; no null brand/manufacturer/category slugs)*
- [x] Lint fails if a component imports Supabase directly *(verified by temporarily adding a `@supabase/supabase-js` import to `collection-page.tsx`, confirming `npm run lint` fails with the `no-restricted-imports` message, then reverting)*

### Definition of Done
Services + pure query module tested; UI still on JSON (no user-visible change).

---

## Phase 10 — Cars Read from Supabase ✅

### Goal
Switch the existing UI's car data to Supabase and prove functional parity.

### Tasks
- [x] `CollectionPage` (type `cars`) reads through services; add minimal loading + error rendering (consolidated in Phase 29) *(`useQuery<ModelSummary[], AppError>` from `services/models.ts`; `.contentEmpty`/`.contentError` branches with a Try again button calling `refetch()` — trucks are unaffected, `enabled: type === "cars"` keeps the query from ever firing on `/trucks`)*
- [x] Map domain model → existing card/modal props (keep old UI intact) *(`src/services/legacy-adapter.ts`: `toLegacyModel(ModelSummary): DiecastModel`, unit-tested. Sidebar/ModelCard/DetailsModal/collection-filters/url-params are all untouched)*
- [x] Trucks still read JSON in this phase (removed in Phase 11)
- [x] Parity checklist run in the browser: card count, each filter, URL params, `?model=` deep link, modal fields *(227 cards on `/cars`; `?brand=Ford` → 22; `?brand=Chevrolet` → 4 with no separate "Corvette" option in the dropdown; color dropdown shows "Multi" not "MULTI"; `?model=abarth-124-rally-rgt-2017-altaya-green` opens the modal with the right manufacturer/category/year/scale/driver/car number/image)*

### Verification
- [x] 227 cards, identical filter results for every brand/manufacturer/category/color vs JSON baseline (scripted comparison) *(scripted comparison across all 46 brands/19 manufacturers/5 categories/13 colors: 0 unexplained mismatches. The only two differences are the approved Phase 4 transforms — Corvette merges into Chevrolet (4 = 4) and "MULTI" displays as "Multi" (26 = 26) — both confirmed exact matches once accounted for)*
- [x] Network tab: no `car-models.json` request/bundle import on `/cars` *(confirmed in both the dev network log — after these changes, only `truck-models.json` and the Supabase/services chain load, no `car-models.json` — and the production bundle: `grep` for a car slug string in `dist/assets/*.js` returns 0 matches, vs 78 postimg.cc references still present for trucks)*
- [x] Error path: kill network → error state, not blank page *(couldn't reliably force-fail the live page's already-constructed Supabase client's bound `fetch` from outside — `supabase-js` captures `fetch` at client construction, before any in-page monkey-patch can apply — so verified the underlying path directly instead: pointed a client at an unreachable host and confirmed `unwrap()`/`toAppError()` produce `{kind: "network", message: "Can't reach the server...", retryable: true}`, which is exactly what `carsQuery.error.message` renders in the `.contentError` branch; the JSX wiring itself is typechecked and covered by `models.test.ts`'s mocked-error tests)*

### Definition of Done
Cars are Supabase-backed with verified parity; rollback = `git revert` (JSON untouched).

---

## Phase 11 — Retire Trucks & Runtime JSON ✅

### Goal
Remove trucks from the product and eliminate all runtime JSON imports.

### Tasks
- [x] Remove `/trucks` route, landing page, `trucks-logo.png` usage; `/` renders the collection; `/cars` and `/trucks` redirect to `/` **preserving query params** *(and hash — `RedirectToCollection` in `App.tsx` uses `useLocation()` + `<Navigate to={{pathname:"/", search, hash}}>`, not a bare string `to="/"` which would have dropped them). `src/pages/landing-page/` deleted (only place that referenced `cars-logo.png`/`trucks-logo.png`; per the "nothing in `public/` is deleted before Phase 36" rule, the PNGs themselves stay, just unreferenced)*
- [x] Move `truck-models.json` (and keep `car-models.json`) to `archive/legacy-data/` — not bundled, not imported *(`git mv`, so history follows the file)*
- [x] Confirm zero `*.json` imports under `src/`
- [x] Update `CLAUDE.md` (no trucks, data source is Supabase) *(also dropped the now-dead `DiecastType`/`type` prop from `CollectionPage` and `Sidebar` — with only one collection left, `type === "cars" ? … : …` branching was dead weight, not a redesign; `Sidebar`'s tagline is now the static "Diecast Car Collection". Also removed the 4 truck-only `--cat-*` tokens (transport/construction/utility/off-road) from `styles.css`, unreferenced by any remaining data)*

### Verification
- [x] `grep -r "\.json" src` shows no data imports; bundle contains no model data *(`grep -rl "\.json" src --include="*.ts" --include="*.tsx" | grep -v ".test.ts" | grep -v ".test-data.ts"` → empty. Production bundle: 0 matches for a truck slug or a car slug string — car data comes from Supabase at runtime, not the bundle)*
- [x] Old links `/cars?model=<id>`, `/cars?brand=Ford`, `/trucks` all land somewhere sensible *(verified live: `/cars?brand=Ford` → `/?brand=Ford`, 22 cards; `/cars?model=abarth-124-rally-rgt-2017-altaya-green` → `/?model=…`, modal opens with the right model; `/trucks` → `/`, 227 cards)*

### Definition of Done
Production reads only Supabase; archives preserved; trucks gone from UI.

**Manual:** confirm the 39 trucks are intentionally excluded from Supabase (archived JSON only). *(Per docs/SCHEMA.md/ROADMAP architecture, this was already the decision going into Phase 4 — trucks were never imported. This phase just completes the retirement in the app: JSON archived, route removed.)*

---

## Phase 12 — Application Shell & Routing ✅

### Goal
The redesigned header, navigation, page container and route table.

### Tasks
- [x] Route table: `/` (collection), `/about`, `/cars` + `/trucks` (legacy redirects, Phase 11), 404 page *(only routes with a real page get a nav link or a `<Route>` — `/models/:slug`, `/manufacturers`, `/brands`, `/statistics`, `/login`, `/admin/*` don't exist until their own phase (19/22/23/24/25), and "nav only links to pages that exist" (this phase's own rule) means adding them now would either be dead links or premature stub pages pre-empting phases not yet designed. `?model=` modal still works — unchanged, still driven by `CollectionPage`)*
- [x] Header per mockup: logo, nav, search entry (wired in Phase 15), live "N models" from `getCollectionStats()`, theme toggle, Instagram, email *(avatar slot skipped — nothing to show before auth exists in Phase 24; adding an empty slot now would just be clutter)*
- [x] Responsive nav (hamburger → drawer) — desktop first, usable at 360 px
- [x] Page container/max-width/spacing from tokens; scroll-to-top retained *(`--container-max`/`--container-gutter`/`--header-height`/`--tap-target`, all already defined in Phase 3 and unused until now)*
- [x] Optimize the logo (687 KB PNG → SVG/WebP) *(deviation — see below)*; About page (content from owner) *(placeholder — see below)*
- [ ] Footer/socials if in the final design *(no footer in the mockup — socials live in the header, already done)*

### Verification
- [x] Every nav link resolves; unknown URL → 404 page; refresh on any route works (Vercel rewrite) *(`vercel.json` already rewrites all paths to `/`, unchanged)*
- [x] Model count matches DB; keyboard-only nav works *(count comes from `getCollectionStats()` over the live `getModels()` result, shown identically on `/`, `/about` and the 404 page; keyboard: Tab reaches logo → Collection → About → search → count → theme → Instagram → email → menu button in order, Enter activates links, Escape closes the mobile drawer and returns focus to the menu button — verified live)*

### Definition of Done
New shell live on all routes with real data; old content areas temporarily inside it.

**Deviations from the task list (flagged per workflow rule 4):**
- **Logo**: the 687 KB `cars-logo.png` was a landing-page hero image, not a header logo, and it's now unreferenced (the landing page it was on is gone — Phase 11) — deleting it isn't this phase's call (nothing in `public/` before Phase 36). For the actual header logo, reused the existing `public/favicon.svg` (26 KB, already the app's icon and already used as the brand mark in `Sidebar`) rather than commissioning a new asset — it's already SVG, already on-brand, and already established in the UI. If a dedicated logo file exists, swap `Header.tsx`'s `<img src="/favicon.svg">`.
- **About page**: content is a placeholder built only from copy already approved in the mockup ("More than models. A collection of automotive history in 1:43 scale.") — no biography or personal detail was invented. Flagged in-file with a comment. Replace with real copy whenever ready.

**Manual:** review the About page placeholder copy and the favicon.svg-as-logo decision; supply a dedicated logo file and/or real About content if the placeholders aren't good enough to ship. *(Owner confirmed 2026-09-29: placeholders are fine.)*

---

## Phase 13 — Collection Toolbar & URL State ✅

### Goal
Replace the sidebar with the toolbar; make the URL the single source of truth for filters.

### Tasks
- [x] `useCollectionQuery()` hook: parse/serialize `brand`, `manufacturer`, `category`, `color`, (later `q`, `sort`) from `useSearchParams` — **no mirrored local state, no sync effects** *(`src/hooks/useCollectionQuery.ts` — filters are derived with `useMemo(() => getCollectionFiltersFromSearchParams(searchParams), [searchParams])` every render, updates go straight to `setSearchParams`; zero `useState`/`useEffect` in the hook, eliminating the exact bug class the old `Sidebar` had — see `src/utils/url-params.ts`)*
- [x] Multi-value filters via repeated params; **legacy single-value/display-name URLs (`brand=Citroën`) still parse**; canonical form uses slugs *(both forms go through the same `slugify()` normalization on read — `slugify("Citroën") === slugify("citroen") === "citroen"` — so there's no separate legacy-parsing branch to keep in sync. Writes always emit sorted, deduped canonical slugs)*
- [x] Toolbar: Filters button (+active count), Brand / Manufacturer / Category / Color triggers, results count *(`src/components/CollectionToolbar/`. Each trigger is a `<details>` popover listing every option with its facet count from `getFacetCounts()`; desktop/tablet show all four inline, mobile collapses them behind the "Filters (n)" toggle)*
- [x] Active filter **chips** (`Ixo ×`) and **Clear all**; placeholders for view toggle and Sort (wired in 15/18) *(chip labels resolve slug → display name via the facets themselves, since `getFacetCounts()` always includes a currently-selected value's own row (counted against the other filters), so no separate name lookup was needed)*
- [x] Delete `Sidebar`

### Verification
- [x] Unit tests: parse/serialize round-trip, legacy URLs, unknown values ignored safely *(`src/utils/url-params.test.ts`, 18 tests — two real bugs caught and fixed here: (1) dedup ran before slugifying, so `["MULTI","multi"]` didn't collapse to one value; (2) the first implementation rebuilt the URL via delete-then-append, which moves filter keys to the end and broke the "already up to date" no-op check — fixed by splicing each key's new values in at its first original position, like `URLSearchParams.set()` does for a single value)*
- [x] Back/forward and shared URLs reproduce the same filtered view; changing a filter never clobbers `q`/`sort`/other params *(verified live: toggling Ford then browser-Back restores the unfiltered 227, Forward restores the 22-model Ford view; `?model=` and other params pass through `applyCollectionFiltersToSearchParams` untouched by construction)*

### Definition of Done
Shareable filtered URLs; sidebar gone; no effect-based state sync remains.

**Note:** filtering now runs on the Supabase domain shape (`ModelSummary`, via `services/collection-query.ts`'s `filterModels`/`getFacetCounts`) instead of the legacy JSON-era `utils/collection-filters.ts`; `toLegacyModel()` only maps the already-filtered result for the still-legacy `ModelCard`/`DetailsModal`. `collection-filters.ts` itself is untouched and still used for the `?model=` lookup (`findModelById`) and its own characterization tests — cleanup of genuinely dead legacy code is Phase 36's job, not this one's.

---

## Phase 14 — Advanced Filter Experience ✅

### Goal
The rich filter panel from the mockup.

### Tasks
- [x] Filter panel component: desktop/tablet popover/side panel, **mobile bottom sheet/drawer** (same content) *(desktop/tablet: the Phase 13 per-field `<details>` triggers, now content-enhanced below — that already **is** "a popover per field", matching the mockup's four separate toolbar triggers; mobile: the Phase 13 "Filters" toggle now opens a real fixed bottom sheet (scrim, header with title/Clear all/✕, scrollable body with all four sections, "Show N models" footer) instead of just an inline stacked list. Same `FilterFields.tsx` renderers power both, so there's one implementation of each field's content, not two)*
- [x] Manufacturer: searchable checkbox list with counts and selected state; Brand: searchable; Category: pills (colors from tokens); Color: **swatches** (Multi as conic); Scale: hidden until >1 scale exists *(search box only renders past 8 options, so it won't show for short lists; Category pills use `categoryColorVar()` — the same token-driven color `CategoryLabel` uses on the cards; Color swatches reuse `ColorCircle`/`getSwatchBackground()` — Multi has no real DB hex (`colors.hex` is `NULL` for it) so it gets a generic 4-color conic gradient from existing feedback tokens, not a fabricated "real" color; Scale needed no code — there's nothing to hide since only `variant`-tagged groups render)*
- [x] Facet counts computed from the loaded list against the *other* active filters *(unchanged from Phase 9/13 — `getFacetCounts()`, re-verified below)*
- [x] Apply/Clear/Close, focus management, Esc closes *("Apply" reinterpreted honestly: filters already apply live on toggle (Phase 13's proven URL-as-state architecture), so the sheet's footer button is "Show N results" — it closes the sheet, it doesn't stage/commit anything, because there's nothing left to commit. Esc closes both the desktop popovers (native `<details>` doesn't support this natively — added) and the mobile sheet, returning focus to the trigger/toggle button; desktop popovers also close on an outside click)*

### Verification
- [x] Counts correct against a scripted count (e.g. Ixo = 29, Rally = 98 with no other filters) *(verified live: Ixo 29, Rally 98, Racing 84, Supercar 19, Premium 18, Retro 8, Red 33, White 54, Multi 26 — all match the known dataset baseline)*
- [x] Works at 360 / 768 / 1280; keyboard operable *(no horizontal scroll at any of the three; mobile sheet opens/updates live/closes correctly; Esc-close and focus-return verified on both the desktop popovers and the mobile sheet)*

### Definition of Done
All four filters usable on all sizes with counts; matches the mockup panel (categories/data from the DB, not the mockup's sample "Road/Classic") *(categories are the real 5 from the DB — Rally/Racing/Supercar/Premium/Retro — never the mockup's placeholder "Road"/"Classic")*.

---

## Phase 15 — Search & Sorting ✅

### Goal
Collection-wide search and useful sorting.

### Tasks
- [x] Search box (header entry + toolbar) → `?q=`; 250 ms debounce; clear button; loading + no-results state *("header entry + toolbar" turned out to be one box, not two: the Header's single search input (already built as a Phase 12 disabled placeholder) is global — it renders on every page and writes to `/`'s `?q=` (updating in place if already there, navigating there otherwise), and the toolbar/results below react to it. "Loading" state is the pre-existing collection fetch state (search itself is instant client-side filtering, no request); "no-results" is a dedicated `No models match "query".` message, distinct from the filter-only empty state)*
- [x] Fields: name, brand, manufacturer, year, category, driver, car number; **diacritic-insensitive** (`citroen` finds Citroën, `skoda` finds Škoda); ranking: name-prefix > name-contains > other fields *(`matchRank()` in `collection-query.ts`, shared by `searchModels()` (filters on `rank !== null`) and `sortModels(..., "relevance", query)` (orders by rank) — one tier definition, not two independently-maintained ones)*
- [x] Sort options from real data: Recently added, Oldest added, Model A–Z / Z–A, Year newest/oldest, Manufacturer, Brand → `?sort=` *(added `"manufacturer"`/`"brand"` to `SortOption`, plus a `"relevance"` option: with no explicit `?sort=`, the effective default is `relevance` while a search is active and `added-desc` ("Recently added") otherwise — an untouched sort shouldn't visually ignore what you just typed. Explicitly picking a sort always overrides relevance, same as any other e-commerce "sort re-orders past whatever relevance gave you" pattern)*
- [x] Stable tie-breaker (204 models share one added date) so order never flickers *(every comparator already broke ties by slug (Phase 9); strengthened to name-then-slug so equal-year/equal-manufacturer ties read in a sensible order, not just a stable-but-arbitrary one)*
- [x] "Recently added" behavior for `added_at IS NULL` documented (NULL last, then by name) *(unchanged from Phase 9 — `compareAddedAt()`, NULL always sorts last regardless of direction)*

### Verification
- [x] Unit tests for normalization, ranking, every sort, NULL `added_at` *(20 new tests in `collection-query.test.ts` — hand-built fixtures for the ranking tests specifically, since real model names all start with their brand, making "contains but doesn't start with" impossible to exercise from the JSON fixtures alone; 9 new tests in `url-params.test.ts` for `?q=`/`?sort=` parse/serialize)*
- [x] Search + filters + sort combine correctly and survive refresh *(verified live: `/?brand=ford&sort=year-asc&q=e` on a fresh full-page load — not a client nav — correctly shows 20 Ford models containing "e", oldest first, with the sort dropdown reading "Year: oldest" (not "Relevance" — an explicit `?sort=` always wins))*

### Definition of Done
Search and sort work, are URL-persisted, and are covered by tests.

**Bug found and fixed along the way:** the mobile drawer's search box has been invisible since Phase 12 — `.siteSearch`'s base `display: none` (shown only ≥640px) was never overridden for the `.siteSearchMobile` variant, and separately its `flex: 1 1 220px` (sized for the horizontal desktop header row) became a *height* basis inside the drawer's vertical flex stack, so even after fixing `display` it first rendered as a ~220px-tall blob. Both went unnoticed because the box was a disabled placeholder until this phase made it functional. Fixed: `display: flex; flex: none;` on `.siteSearchMobile`.

---

## Phase 16 — Model Card Redesign ✅

### Goal
Photography-first card per the mockup.

### Tasks
- [x] Card layout: image primary; manufacturer logo (top-left), scale badge (top-right); car number + driver pill (bottom) **only when present**; title + color dot(s); meta row brand logo · year · manufacturer · category (token color) *(the existing layout already matched this closely — the real work was rebuilding it against `ModelSummary` directly instead of the legacy `DiecastModel`/`toLegacyModel()` bridge, restyling with current design tokens instead of undefined/legacy CSS vars, and the fixes below)*
- [x] Racing info handles any combination (number only, driver only, both, neither — audit D7) *(verified live with real data: `mazda-rx-7-fd-1993-altaya-orange` (Premium, no crew) shows neither badge; `mazda-rx-7-fd-1993-deagostini-red` (Racing, `carNumber` only) shows just "#3" — the exact D7 example)*
- [x] States: default, hover, focus-visible, loading skeleton; whole card is a real link/button (fixes the non-focusable card) *(card is now one `<button type="button">` wrapping the whole thing, not just an `onClick` on the thumbnail `<img>`; `ModelCardSkeleton.tsx` — same box model as a real card, shown instead of the old plain-text "Loading the collection…" while `getModels()` is pending)*
- [x] `ColorCircle` restyled and reused; drop nested borders
- [x] Logo URLs via `logo_path` with `encodeURI`; image fallback hook (final visuals in Phase 29) *(`ModelSummary.brand.logoPath`/`manufacturer.logoPath` — already resolved by the importer, e.g. `/brands/Aston Martin.svg` — through `encodeURI()`; `onError` on the main image, manufacturer badge and brand logo each fall back independently: broken main image → the model name as text; broken manufacturer/brand logo → its name as text)*

### Verification
- [x] Visual check vs mockup at 1440; a road car shows no racing UI; a number-only model (Mazda RX-7 FD) renders sensibly *(checked live in both themes — matches the mockup's card treatment closely: image-first, manufacturer/scale badges, title + color dot, brand/year/manufacturer/category meta row)*
- [x] Tab/Enter opens the model *(verified live: focused a card via real Tab key presses, pressed Enter, `?model=<slug>` was set and the modal opened with the right title)*

### Definition of Done
New card used everywhere the old one was; old `ModelCard` styles removed.

**Two real bugs found and fixed during the rebuild (verification, not assumption, is why these were caught):**
1. The driver's steering-wheel icon rendered at full-thumbnail size on every racing card. Cause: `.thumb img { width:100%; height:100% }` (specificity 0,1,1) beats a bare `.carDriverLogo` (0,1,0) regardless of source order — the old code masked this with `!important`; the rebuild dropped that without fixing the underlying specificity. Fixed by scoping to `.carDriverBadge .carDriverLogo` (0,2,0).
2. The keyboard focus ring was invisible on cards. Cause: `.card`'s own resting `box-shadow` and the global `:focus-visible { box-shadow: var(--focus-ring) }` rule have equal specificity (0,1,0 each), so whichever stylesheet happened to load last silently won — not the focus state. Fixed with an explicit `.card:focus-visible { box-shadow: var(--focus-ring) }` in `ModelCard.css`.

---

## Phase 17 — Collection Hero & Grid ✅

### Goal
Intro area and responsive grid per the mockups.

### Tasks
- [x] Hero: eyebrow "MY COLLECTION", **count from data**, subtitle, tagline (fix the mockup's "Diecas" typo), background art (asset from owner) *(`src/components/CollectionHero/`. Title reads "227 Diecast Models" with the count from `getCollectionStats()` (gold, per mockup) — a shimmer placeholder while loading, no number at all on error rather than a misleading "0". Subtitle is data-driven too: "A personal collection of 1:43 scale models" only while the data has exactly one scale (new `CollectionStats.scales`), scale-agnostic wording otherwise. Tagline "Small cars. / Big stories." with the gold rule, tablet+ only. **Background art: not delivered yet**, so the hero ships with a token-only backdrop (gold glow + faint diagonal sheen, `--hero-*` tokens per theme); `HERO_ART_URL` in `collection-page.tsx` is the one-line slot for the owner's image — it layers in on the right with a fade mask and falls back to the gradient if it fails to load)*
- [x] Grid: mockup targets — desktop ~5, tablet 3, mobile 1 (confirm against final mockups; prefer `auto-fill/minmax` if it reproduces them) *(it does: one rule, `repeat(auto-fill, minmax(min(100%, var(--card-min-width)), 1fr))` with `--card-min-width: 220px`, replaces the four per-breakpoint column counts. The key enabler was dropping the legacy bordered `.main` panel (the mockup puts hero + grid straight on the page background) and using the Header's `--container-max`/`--container-gutter`, so content aligns with the logo/nav and the widths work out)*
- [x] Remove `.thumb { min-width: 250px }` and other forced widths *(the `.thumb` one was already gone with the Phase 16 rebuild; the page's remaining hard-coded paddings/radii/legacy vars (`--panel`, `--muted`, the legacy green `--accent` on the retry button, `z-index: 1200` on the back-to-top button — it floated above the modal) are now semantic tokens)*
- [x] Results header (count, active state) between toolbar and grid *(`describeResults()` in `src/utils/collection-summary.ts`: "227 models" untouched; "29 of 227 models · matching "ford" · 2 filters" when narrowed, with the count emphasized. `aria-live="polite"`. The toolbar's own inline "N models" was moved here rather than duplicated; `resultsCount` still feeds the mobile sheet's "Show N models" button)*

### Verification
- [x] 227 (or filtered) cards render; counts match; columns at 360/768/1024/1440/1920 *(live: 227 cards / "227 models" unfiltered; `?manufacturer=ixo&category=rally&q=ford` → 3 cards, "3 of 227 models matching "ford" · 2 filters". Columns measured from the computed grid: **360 → 1, 768 → 3, 1024 → 4, 1280 → 5, 1440 → 5, 1920 → 6**; `scrollWidth` never exceeds the viewport. 13 new unit tests (`collection-summary.test.ts`, `stats.test.ts`))*
- [x] No layout shift when images load (aspect ratio reserved) *(card thumbs already reserve `aspect-ratio: 4/3` (Phase 16). Measured with a `layout-shift` PerformanceObserver on a cold load: first run 0.012, traced to the results header appearing only after data arrived and pushing the skeleton grid down — fixed by rendering it (as "Loading models…") during loading too. After: 0.0008 total, from font/scrollbar settling (the header's social icons shift with it), not images)*

### Definition of Done
Hero + grid match the Desktop mockup; usable on narrow widths. *(checked at 1440 in both themes against `Mockup Overall.png`)*

**Deviation to confirm in Phase 32:** the Tablet/Mobile mockup references show no hero at all. This phase keeps a compact hero on mobile (eyebrow, title, subtitle; tagline hidden) because it carries the page's only `<h1>`. If the final mobile mockup drops it, the fix is to make it visually hidden below 640px, not to remove it.

---

## Phase 18 — Alternative Collection Views ✅

### Goal
View modes defined by the mockup toolbar.

### Tasks
- [x] Grid (default), List, Compact (the three toolbar icons); each reuses card data *(all three render straight off `ModelSummary`, whole item = one `<button>` with `id={slug}` like the card, so `?model=` deep-link scroll and the modal keep working in every mode. **List** (`ModelListRow`): photo-led row — thumbnail, title + color dot, the card's meta row, inline racing info (number/driver only when present, audit D7), manufacturer logo + scale on the right. **Compact** (`ModelCompactRow`): dense table-like rows in one bordered block — small thumb · name · brand · year · manufacturer · racing · category, columns aligned via a shared grid template (racing column desktop-only, brand/manufacturer/year collapse into a sub-line on mobile). Both in `src/components/ModelCard/ModelRow.tsx`; the logo-with-text-fallback logic the card had inline is now a shared `LogoOrText` component, and `logoSrc()`/`countryCodeToFlagEmoji()` moved to `src/utils/model-display.ts`. Toolbar: the Phase 13 disabled placeholder icons are now a real `role="group"` of `aria-pressed` toggle buttons with SVG icons)*
- [x] Persist choice in `localStorage` (guarded), not in the URL *(`src/utils/view-mode.ts` — `readViewMode()`/`writeViewMode()` take the storage as an argument and swallow every failure (missing storage, throwing getter/setter, unknown stored value → `grid`); `useViewMode()` hook on top. Key `zk-view-mode`, alongside the theme's `zk-theme`)*
- [x] **Showcase** carousel view is "optional" in the mockup — decide at phase start (build or defer) → **deferred by the owner** (2026-09-30). It works best with the curated photography/`model_images` gallery that arrives in Phases 20–21; revisit then. An old/garbage `showcase` value in storage just falls back to Grid (tested)

### Verification
- [x] Switching preserves filters/search/sort/scroll sensibly; refresh keeps the mode *(filters/search/sort are untouched — they live in the URL, the mode doesn't. Scroll: switching anchors on the first on-screen model and restores its viewport offset in a `useLayoutEffect` (before paint), so you stay on the same model even though every item's height changes — measured live: compact→grid −21.95→−22.33px, grid→list −13.48→−13.95px for the same model. Refresh on `?manufacturer=ixo` in Compact came back in Compact with the URL unchanged. Skeletons follow the mode too, so loading → loaded doesn't reflow)*
- [x] Each mode usable at 360 px *(checked live at 360 in dark theme: `scrollWidth` = 360 in every mode; Filters · 3 view buttons · Sort fit on one row — the view buttons are 36px wide (full 44px tap height) below tablet and the sort trigger shows just "Sort ▾" there (current option kept for screen readers), per the mobile mockup. At 360 the List row drops its right column and puts the scale on the photo like the grid card. Also no overflow at 768/1440; keyboard Tab → Enter on a compact row opens the model, focus ring visible, focus returns to the row on close. 22 new unit tests: `view-mode.test.ts`, `model-display.test.ts`)*

### Definition of Done
Approved view modes implemented and persisted; Showcase built or explicitly deferred. *(Showcase explicitly deferred)*

---

## Phase 19 — Model Details Page ✅

### Goal
A collector-catalogue page at `/models/:slug`.

### Tasks
- [x] Layout per mockup: breadcrumb (`Collection › Brand › Model`; model-line level only if the owner wants it and data exists), header (brand logo, title, year · manufacturer · scale · category), six spec tiles, tabs (*Overview / Specifications / Gallery / My Collection / Notes*) *(`src/pages/model-details-page/`. Breadcrumb is `🏠 Collection › Brand › Model` — no model-line level (no data, docs/SCHEMA.md §8); "Brand" links to the collection filtered by that brand until the brand page exists (Phase 22). Photo left with the card's manufacturer/scale badges, header right: brand logo, `<h1>`, "year · manufacturer · scale · [category pill]", racing pills, gold rule, then the six tiles (Brand, Manufacturer, Category, Scale, Color(s), Year — 3×2, 2×3 on mobile). Brand/Manufacturer/Category tiles are links to the collection filtered by that value (they carry a › affordance). Tabs are the WAI-ARIA pattern: roving tabindex, ←/→/Home/End)*
- [x] **Sections/tabs render only when they have data** (no fabricated description/tags/features) *(pure rules in `src/utils/model-details.ts` — `getAvailableTabs()`: **Overview** only with a description, key features or tags; **Specifications** always (it's the full fact sheet, so no page is ever empty); **Gallery (n)** only with more than one image (plain thumbnails for now, the viewer is Phase 20); **My Collection** only when a public collection field is set. With a single section there's no tab bar — just a "Specifications" heading. `Model.tags` added to the service (`model_tags` → `tags`, 0 rows today))*
- [x] Racing information shown only for racing models; "My Collection" shows only the public fields chosen in Phase 4 *(racing pills (number/driver+flag) in the header and a "Racing" spec group — car number, driver, team, series, event — each only when set, audit D7. My Collection = Added / Condition / Location only (decision 5); dates render "12 Apr 2025" with fixed month names, not Intl — en-GB ICU gives "Sept")*
- [x] Back-to-collection preserves previous filters; unknown slug → 404 *(opening a model passes the collection's query string in router location state (`src/utils/model-link.ts`, validated on read — history state is untrusted); the "Collection" crumb returns to exactly those filters/search/sort and brings the model's card into view + focus. Browser **Back** restores the exact scroll offset via the new `useScrollRestoration()` hook (BrowserRouter has no `<ScrollRestoration>`; positions are saved in sessionStorage per `location.key` when an entry is left, so a refresh restores too). Unknown slug → PostgREST `PGRST116` → `not_found` → the app's 404 page, with no retry)*
- [x] Legacy redirect: `/?model=<id>` (and `/cars?model=`) → `/models/<id>`; remove scroll-then-open timeout logic *(`getLegacyModelRedirect()` — any other params on the old link become the way back. The modal state, `lastOpenedModelIdRef`, both timeouts and `withModelParam`/`withoutModelParam` are gone; cards/rows are now real `<Link>`s (open-in-new-tab works) instead of buttons)*
- [x] Admin buttons (Edit/Delete/…) placeholders wired in Phase 24/25 *(a marked slot in the details header; nothing is rendered to the public before auth exists)*

### Verification
- [x] Deep link + refresh works; old shared links redirect; tab state survives refresh *(live: `/?model=mazda-rx-7-fd-1993-deagostini-red&brand=mazda` → `/models/mazda-rx-7-fd-1993-deagostini-red` with the crumb pointing at `/?brand=mazda`; `/cars?model=…&q=gt` redirects too. `?tab=collection` survives refresh (it's a `replace`, so tabs don't add Back steps; the default tab writes no param), and so does the way back. Crumb → `/?brand=mazda`, 4 cards, the RX-7 card focused. Scrolled to 3000px, opened a card, Back → 3000px, the card at the same 243px viewport offset. `/models/not-a-real-model` → 404. No console errors on a clean load)*
- [x] A model with no extra data looks intentional, not empty *(e.g. `aston-martin-db11-2016-altaya-gray`: photo, header, six tiles, and a "Specifications" section — no empty tabs, no "—" placeholders, no fake copy. Checked at 360 (`scrollWidth` = 360), 768 and 1280 in dark + light. 25 new unit tests (`model-details.test.ts`, `model-link.test.ts`) plus tag assertions in `models.test.ts`; the 4 `withModelParam` tests went with the helpers)*

### Definition of Done
Details page replaces the modal deep-link path with parity of information. *(every field the modal showed — image, brand, manufacturer, category, year, colors, scale, driver, car number — is on the page)*

**Deviations from the mockup (all from decisions already recorded, none invented here):** no heart / "Add to Collection" (open decision 7 — meaning still undecided); no "Collected" badge and no "Notes" tab (docs/SCHEMA.md: every model is owned, and notes are admin-private); no description blurb under the title (there's one `description` field — it lives in Overview, not twice); no thumbnail strip, prev/next, `1 / n` or fullscreen button on the photo (Phase 20); no "…" / Edit (Phase 24/25). `DetailsModal` is now unreferenced but left in place — Phase 20 deletes it with `toLegacyModel()`/`findModelById()`.

---

## Phase 20 — Gallery, Lightbox & Quick View ✅

### Goal
Great photography experience; replaces `DetailsModal`.

### Tasks
- [x] Gallery from `model_images`: primary, thumbnails, prev/next, `1 / n` counter (degrades gracefully to the single image all models have today) *(`src/components/Gallery/ModelGallery.tsx`, controlled by `useGallery()`: opens on the primary photo; arrows, counter and thumbnail strip appear only with more than one photo, so today's single-photo models show just the photo, its manufacturer/scale badges and a fullscreen button. ←/→ work while focus is inside the gallery; the counter has a visually-hidden "Photo 2 of 4" live region. Rows with no URL at all aren't counted (`displayableImages()`). The details page's Gallery tab is now a grid of buttons that open the lightbox on that photo. Owner alt text (`model_images.alt`, now mapped) wins over the generated "Name (year), Manufacturer 1:43 model, photo 2 of 4")*
- [x] Lightbox: fullscreen, `←/→/Esc`, touch swipe (pointer events, no library), neighbor preloading, loading skeleton, missing-image fallback *(`Lightbox.tsx`: a viewport-filling native `<dialog>` on the black scrim, title + counter + close, prev/next, thumbnail strip. Swipe = a mostly-horizontal pointer move ≥ 48px (`swipeDirection()`; `touch-action: pan-y pinch-zoom` keeps vertical pan/zoom native); a click on the empty stage closes, unless it ended a swipe. The photos either side are preloaded with `new Image()`. `GalleryImage` shows the shimmer until `onLoad`, then fades in; `onError` → "Image unavailable". New theme-independent tokens `--color-on-scrim(-muted)` / `--color-scrim-control(-hover)`, since the scrim is black in both themes)*
- [x] Quick View modal from cards (native `<dialog>` with focus trap/restore) — confirm it stays given the details page → **confirmed by the owner (2026-09-30)** *(`src/components/QuickView/`, per the mockup's "Quick View Modal (Desktop)": gallery (no strip), title, year · manufacturer · category · color dot, the six tiles (now the shared `SpecTiles` component, unlinked here — a link would change the page behind the dialog), gold "View Details →" carrying the same link state as the card. It renders instantly from the `ModelSummary` and loads the full model into the `["model", slug]` cache the details page reads. Trigger: a "Quick view" pill over the card photo, shown on hover or keyboard focus, hidden on touch-only devices. `useModalDialog()` does open-on-mount, Escape/backdrop/close-button → `onClose`, focus back to the trigger, and a counted `html.modalOpen` scroll lock (so the lightbox can stack over Quick View))*
- [x] Storage-ready image URL resolver (postimg now, Storage in Phase 21) *(`src/services/image-url.ts`: `resolveImageUrl()` — `storage_path` → `https://<ref>.supabase.co/storage/v1/object/public/model-images/<path>` (segments encoded), else `external_url`; used by both mappers. Before this, a `storage_path` would have been used verbatim as a relative URL. Phase 21 only has to fill the column)*

### Verification
- [x] Keyboard-only and touch flows work; focus returns to the trigger *(live, keyboard only: Quick view button → dialog focuses its close button; Tab → fullscreen → Enter opens the lightbox on top (focus on its close); Escape closes only the lightbox, focus back on the fullscreen button; Escape again closes Quick View, focus back on the card's Quick view button, scroll lock released. Backdrop click closes, clicks inside don't. With a 4-photo gallery simulated in the browser (the `model_images` response intercepted client-side — no data changed): prev/next wrap both ways, ←/→ keys, thumbnails, a broken URL shows "Image unavailable" in both the gallery and the lightbox, left/right swipes step, a vertical drag doesn't, closing the lightbox leaves the gallery on the photo you ended on. "View Details" → details page with the crumb back to `/?brand=dodge`, Back restores the collection. No console errors in a clean run. No horizontal scroll at 360 / 768 / 1280; at 360 the Quick View trigger is hidden (touch) and the lightbox fits (336px stage). Light + dark checked. 20 new unit tests (`gallery.test.ts`, `image-url.test.ts`, an alt-text case in `mappers.test.ts`; the storage-path mapper test now expects a real Storage URL); 5 removed with the deleted code — 508 total)*
- [x] Old `DetailsModal` no longer referenced *(deleted, with `legacy-adapter.ts` (`toLegacyModel()`) + its test, `findModelById()` + its test, and `DetailsModal.css`'s hard-coded-color allowance in `tokens.test.ts`)*

### Definition of Done
Gallery + lightbox + Quick View shipped; `DetailsModal` deleted or unreferenced. *(deleted)*

**Notes / deviations:**
- Quick View is on **grid cards only**. List and Compact rows go straight to the details page — Compact is a dense table and List's photo is small; say if you want it there too.
- The mockup's Quick View "Add to Collection" button is not rendered (open decision 7, same as the details page's heart). The tile order is the details page's (Brand, Manufacturer, Category / Scale, Color, Year) rather than the Quick View mockup's slightly different order, so the component is shared.
- A Chrome quirk found in verification: a dialog's `close` event is delivered with rendering, so it can lag (or stall while the tab isn't painting). `useModalDialog` therefore reports Escape via the synchronous `cancel` event and has its own close buttons call `onClose` directly; `close` is only a fallback.
- postimg.cc serves a 320px placeholder image for a missing file instead of an error, so a dead postimg link shows postimg's placeholder rather than our "Image unavailable" (which covers network errors and non-images). Phase 21's move to Storage removes this.

---

## Phase 21 — Supabase Storage Migration 🟡

### Goal
Move images off postimg.cc into Supabase Storage safely.

### Tasks
- [x] Bucket `model-images`: public read, admin-only write policies; path scheme `models/{slug}/{position}-{full|thumb}.webp|png` *(migration `20260930120000_diecast_storage.sql` — **not applied yet**: public bucket, WebP/PNG/JPEG only, 5 MB limit; `storage.objects` INSERT/UPDATE/DELETE **and SELECT** only for `diecast.is_admin()` — public URLs need no policy, and without a SELECT policy anon can't list the bucket. `npm run verify:rls` gained 12 storage checks (75 total). Paths are `models/{slug}/{position}-full.webp` / `-thumb.webp`; `.png` is only the browser helper's fallback where a browser can't encode WebP)*
- [x] Resumable migration script with **retries** (audit saw transient fetch failures), checksums, `--dry-run`, skip-already-done *(`npm run images:migrate` — dry run by default, `--apply` to upload. Retries: exponential backoff + jitter on network errors/timeouts/408/425/429/5xx, never on 404 — a 6-image trial run hit and recovered from a real `fetch failed`. Resume: a manifest (`scripts/migrate-images/manifest.json`) is rewritten after every source; a source is skipped when both variants are recorded from the same URL with the same settings **and** Storage still has them at the recorded size. Checksums: sha256 of every original and every output; each upload is followed by a size check, and `npm run images:check -- --full` downloads every object and compares sha256 + dimensions. One bad source never stops the batch; re-running retries only what failed)*
- [x] Keep `legacy_url` on `model_images` until verification; flip to `storage_path` only after checks *(`legacy_url` = `external_url`/`thumb_external_url`, which nothing ever clears. `npm run images:flip` first re-verifies every object against the manifest (download + sha256 + dimensions) and refuses if any row isn't uploaded from its current URL, then sets `storage_path`, `thumb_storage_path`, `width`, `height` for all rows in **one transaction** via `diecast.set_image_storage()` (service role only; dry run by default, like the importer). The app needs no change — Phase 20's `resolveImageUrl()` already prefers `storage_path`)*
- [x] Thumbnails: check if Storage image transformations are available on the plan; otherwise generate at import (and at upload in Phase 27) *(transformations are a paid feature → generated here: both variants from the full-size original, the old postimg thumbnails aren't used)*
- [x] **WebP pipeline, reusable across apps (owner decision 2026-09-27, option A):** image transformations are a paid feature, and free egress is ~5 GB/month (~40 MB per full collection view with today's ~177 KB thumbnails). So generate WebP ourselves: thumbnail ~400 px / ~20–30 KB, full ~1600 px. Build it app-agnostic so the **games and recipes apps can copy it**:
  - `scripts/images/`: config-driven batch converter (`sharp`): source list → sizes/quality → bucket + path pattern, with retries, resume and `--dry-run`. No diecast-specific code *(an app default-exports an `ImageJob` {bucket, pathPattern, variants, manifest, sources()} and runs `scripts/images/cli.ts <job> upload|verify`. Variants fit inside the box, never enlarge, EXIF-rotate, strip metadata, keep transparency. The diecast job + flip + verify live in `scripts/migrate-images/`. 37 unit tests (`scripts/images/*.test.ts`, `scripts/migrate-images/plan.test.ts`, `src/lib/image-resize.test.ts`) — real sharp conversions against a fake network/Storage: dry run uploads nothing, resume skips, vanished objects/changed URLs/changed settings are redone, 503s retried, 404s not, a size mismatch after upload fails the source, corrupted bytes are caught by the sha256 check)*
  - `src/lib/image-resize.ts`: self-contained browser helper (canvas → WebP) reused by the Phase 27 upload form *(no imports; `resizeImageVariants(file, variants)` decodes once (`createImageBitmap`, EXIF-aware), halves step-wise before the final draw to avoid aliasing, `OffscreenCanvas` with a `<canvas>` fallback; reports `ext: "png"` where the browser has no WebP encoder)*
  - README in `scripts/images/` on how to adopt it in another repo. Extract into a shared package later only if the three copies start diverging
- [x] Verify total size fits the plan (est. ~230 MB); no base64 in Postgres *(full dry run, 2026-09-30, all 227 originals: 198.7 MB of PNG → **30.7 MB** of WebP (full 227 × avg 114 KB, 1047–1280 px wide — no original exceeds 1600, so none is downscaled; thumb 227 × avg 24.7 KB, 9–32 KB), well inside the free plan's 1 GB. A full collection view drops from ~40 MB to ~5.5 MB of thumbnails. Postgres stores only paths)*

### Verification
- [ ] Every image row resolves (HEAD 200); byte/dimension spot checks; page renders with Storage URLs *(tooling ready: `npm run images:verify -- --legacy --sample=all` resolves each row with the app's own `resolveImageUrl()` and HEADs full + thumb, compares sampled objects with the manifest, and HEADs every postimg URL. Run today, before the migration: 227 rows, 454 URLs → all 200 (all still postimg). Pending the owner's run, then a browser check that images load from Storage)*
- [x] Rollback path documented (`legacy_url` still valid) *(`scripts/migrate-images/README.md` § Rollback: `npm run images:flip -- --rollback --apply` clears both storage paths in one transaction and the app falls back to postimg with no deploy; objects stay in Storage for a re-flip. All 454 postimg URLs answered 200 on 2026-09-30)*

### Definition of Done
All 227 models' images served from Storage; postimg URLs retained only as `legacy_url`. *(pending the owner's run)*

**Manual:** run the migration script locally with the service-role key. → **Runbook: [`scripts/migrate-images/README.md`](scripts/migrate-images/README.md)** — apply the migration, `npm run verify:rls`, `npm run images:migrate -- --apply`, `npm run images:check -- --full`, `npm run images:flip -- --apply`, `npm run images:verify -- --legacy --sample=all`, commit `scripts/migrate-images/manifest.json`.

**Notes / deviations:**
- New dev dependency **`sharp`** (0.35): the only maintained Node library that resizes and encodes WebP with good quality; prebuilt binaries, no install script, used by scripts only (never bundled).
- Objects are served with `Cache-Control: max-age=604800` (a week) to save egress. Replacing a photo in Phase 27 should therefore write a **new path** rather than overwrite one.
- `tsconfig.scripts.json` now includes `src/vite-env.d.ts`, so scripts can share `src/services/image-url.ts` (the bucket name) with the app.

---

## Phase 22 — Manufacturer & Brand Browsing ✅

### Goal
Browse the collection by manufacturer and by brand.

### Tasks
- [x] Index pages (`/manufacturers`, `/brands`): logo, name, model count *(`src/pages/browse-page/browse-index-page.tsx`. Eyebrow "Browse", title, "19 manufacturers · 227 models", then a tile per entry: logo on a sunken plate, name, gold count, a **category-mix bar** (each category's share in its `--cat-*` color; the same numbers as visually-hidden text), year range and the other dimension ("42 brands" / "4 manufacturers"). Order: **Most models** (default) or **A–Z**, in `?order=name` (not `?sort=`, which is the model sort). Only brands/manufacturers that have models are listed — 19 and 45 today)*
- [x] Detail pages (`/manufacturers/:slug`, `/brands/:slug`): logo, count, categories represented, model grid reusing the card + collection query *(`browse-detail-page.tsx`: breadcrumb `Collection › Manufacturers › Altaya`, a profile (large logo plate, "Manufacturer" eyebrow, `<h1>`, "130 models · 1969–2023 · 42 brands"), then **Categories**: the mix bar plus the collection's own `CategoryPills` with counts — they double as the bar's legend and as this page's filter (`?category=`). Below: "N models" / "2 of 4 models · Clear", **Open in collection ›** (`/?manufacturer=altaya` plus any picked categories — the rest of the filters, search and view modes live there) and the toolbar's `SortTrigger` (`?sort=`, the brand/manufacturer option hidden on its own page). The grid is `ModelCard` + Quick View. It reuses `useCollectionQuery()` and `filterModels`/`getFacetCounts`/`sortModels` with the page's brand/manufacturer pinned. A non-canonical slug (`/brands/Citroën`, `/brands/Ford`) redirects to the slug; an unknown one → 404)*
- [x] Shared components for both (same pattern, different data) *(one index and one detail page component, `kind: "brands" | "manufacturers"` picks the data; `src/components/Browse/` (`BrowseTile`, `BrowseLogo`, `CategoryMixBar`, skeleton). Data: `src/services/browse.ts` — `getBrowseEntries()`/`getBrowseEntry()`/`getBrowseModels()`/`sortBrowseEntries()`, pure over the cached `["models", "cars"]` summary list, so arriving from the collection costs no request. Routes are keyed per kind/slug so switching between two browse pages never reuses a component instance. The breadcrumb is now a shared `Breadcrumb` component (styles moved out of the details page))*
- [x] Links from cards, details spec tiles and filter panel *(details page: the Brand/Manufacturer **spec tiles** and the **brand crumb** open the browse pages (Category still opens the filtered collection); the brand crumb carries `focusModel`, so the brand page brings the model's card into view and focuses it. **Cards**: a card is one `<Link>` to its model, and links can't nest, so the card's secondary links live in its **Quick View** — its Brand/Manufacturer tiles now link to the browse pages (`SpecTiles linked="browse"`; not Category, which would re-filter the page behind the open dialog). Navigating closes the dialog; on a browse page Quick View is tied to its history entry, so a tile linking to the same page closes it too. **Filter panel**: the Brand and Manufacturer fields end with "Browse all brands ›" / "Browse all manufacturers ›" (popover and mobile sheet). **Nav**: Manufacturers and Brands added to the header (desktop + drawer))*

### Verification
- [x] Counts match filter-panel counts; Altaya = 130, Ixo = 29, Ford = 22 *(by construction — both come from the same summary list, and `getBrowseModels()` is literally the `?manufacturer=`/`?brand=` filter; a unit test asserts every entry equals the unfiltered facet counts. Live: the index's 19 manufacturer counts equal the Manufacturer filter popover's, Altaya 130 / Ixo 29 cards, Ford 22 cards, Mazda + Racing = 2 of 4)*
- [x] Unknown slug → 404; logos with accents/spaces load *(`/brands/not-a-brand` → 404 page; `/brands/Citro%C3%ABn` → `/brands/citroen` with its logo; `/brands/aston-martin` loads `/brands/Aston%20Martin.svg`. All 45 brand and 19 manufacturer logos load, no text fallbacks. No horizontal scroll at 360 / 768 / 1280, dark + light; no console errors. 19 new unit tests: `browse.test.ts`, `browse-link.test.ts`, `browse-display.test.ts` — 571 total)*

### Definition of Done
Both browse experiences live; nav entries enabled. *(No mockup existed — open decision 2 — so the pages are designed from the established system: the card surface, gold accent, category colors, the hero's eyebrow/title type and the toolbar's controls. Review welcome.)*

**Notes / deviations:**
- The mockup's nav shows *Manufacturers* only; *Brands* sits next to it as its twin, since the roadmap asks for both pages. Say if you'd rather reach Brands only from the Manufacturers page / filters.
- Logos: the SVGs are drawn in a fixed light grey (`#A9B1BF`), so in the light theme they're low-contrast here just as they already are on the cards and details page. A theme-aware logo treatment belongs in the Phase 30 fidelity pass.
- The browse detail page shows the grid only (no List/Compact) and filters by category only; "Open in collection" hands over to the full toolbar.

---

## Phase 23 — Collection Statistics ✅

### Goal
Useful, data-driven statistics in the premium style.

### Tasks
- [x] Computed from the cached collection / a DB view — **nothing hard-coded** *(`getCollectionBreakdown()` in `src/services/stats.ts`, pure over the cached `["models", "cars"]` summary list — the same list the collection, filters and browse pages use, so opening Statistics from anywhere else in the app costs no request. It reuses `getFacetCounts()` (the filter panel's counts) and `getBrowseEntries()` (the browse pages'), so the three can't disagree. No DB view was needed)*
- [x] Totals (models, manufacturers, brands, categories); top brand / manufacturer; models by decade (1960s–2020s); racing vs road (via `is_racing`); color distribution with real swatches *(`/statistics`, `src/pages/statistics-page/`: four **stat tiles** (Models → collection, Brands → `/brands`, Manufacturers → `/manufacturers`, Categories); **Top brand** / **Top manufacturer** cards (logo, name, "22 models · 10% of the collection", link to the browse page; a tie lists everyone at the top); **Racing vs road** as a meter ("80% are race or rally cars", 182 / 45); **Models by decade** as columns — every decade from the oldest model's to the newest's, empty ones included, so the time axis has no silent gaps (1960s–2020s today); **By category** bars (each row → `/?category=`); **Top brands** / **Top manufacturers** (10 each, logos, → browse pages, "All 45 brands ›"); **By color** with each color's real `colors.hex` swatch (Multi: the filter's generic swatch), each row → `/?color=` — a two-tone livery counts once per color, exactly like the Color filter, and the card says so)*
- [x] Skip meaningless charts; choose chart form per the dataviz guidance (simple bars/tiles) *(totals are stat tiles, one share of a whole is a meter (not a two-slice pie), everything else compares magnitudes → bars in **one hue** (`--chart-bar`), values written at the bar tips, identity from the text label plus swatch/logo, never color alone. No pies, no "by scale" chart (all 227 are 1:43), no year-by-year chart (decades say it with 7 bars instead of 50). The category colors were checked with the dataviz palette validator and **fail** as a chart palette (Premium ↔ Supercar ΔE 1.2 under protanopia; Racing ↔ Rally ΔE 11 even with full color vision), so they're deliberately not used for the bars — see docs/DESIGN-TOKENS.md § Charts)*

### Verification
- [x] Every number cross-checked with a SQL query *(new `npm run verify:stats` (`scripts/verify-stats.ts`): runs the page's own `getCollectionBreakdown()` on the live view, then recounts every number independently with a `count(*)` on the base tables (`models`, `model_colors`) — per brand, manufacturer, category, color, decade (plus before/after the range, which must be 0) and racing flag — and fails on any difference. **97/97 match** (2026-09-30). The same queries as plain SQL for the dashboard editor: `supabase/checks/statistics.sql`)*
- [x] Updates automatically after a model is added *(nothing is stored or hard-coded — every number is recomputed from the model list on load; a unit test adds a model (new brand, 1955, road car) and sees a new 1950s column, 46 road cars and 46 brands. After `npm run import:cars -- --apply`, a reload shows it)*

### Definition of Done
Statistics page accurate, responsive, accessible (labels/tables for chart data). *(Every bar list is a real `<table>` (row header = name, cell = count) labelled by its card title; the decade columns are a list with one "1990s: 31 models" item per column; the meter is `role="meter"` with "182 of 227"; all values are visible text, so no number lives only in a tooltip. Layout: 3 columns on desktop (decades two wide beside categories, then brands / manufacturers / colors), 2 on tablet, 1 on phones — no horizontal scroll at 360 / 768 / 1280, dark + light, no console errors. New `--chart-bar` / `--chart-track` tokens; the contrast test now also requires the bar color ≥ 3:1 on every surface in both themes. 29 new tests — 600 total. Nav: "Statistics" between Brands and About, as in the mockup's order)*

**Notes / deviations:**
- No mockup existed (open decision 2), so, like Phase 22, the page is built from the established system. Review welcome.
- The decade chart counts by the **real car's** year (the only year stored), not by when the model was made or bought — the subtitle says so.
- Small cleanups: the page heading from Phase 22 is now a shared `PageIntro` component (browse index + Statistics); the "Multi" swatch moved to `src/utils/color.ts` (`colorSwatchHex()`), shared by the Color filter and the color chart.
- Phase 22's category-mix bar (browse tiles/profiles) uses the category colors that fail the validator. It's backed by the labelled pills and visually-hidden text there, so nothing is color-only, but if you'd like it to follow the same rule, it can become a single-hue bar in the Phase 30 fidelity pass.

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
| 2 | **No mockups exist** for Manufacturers, Brands, Statistics, About, Login. Generate them, or should I design them from the established system? *(Phases 22–23 designed Manufacturers/Brands/Statistics from the system — review them)* | Ph 22, 23, 24 |
| 3 | **Light theme**: keep (derived from tokens, no mockup) or dark-only? *Phase 3 kept it, with derived values that pass contrast. Confirm, or say dark-only* | Ph 3 |
| 4 | ~~Confirm trucks are excluded~~ → excluded; schema has no truck data (Phase 4) | Ph 4 / 11 |
| 5 | ~~Public "My Collection" fields~~ → condition, added, location **public**; notes private; **no collected/status field** (all owned) (Phase 4) | Ph 4 |
| 6 | Description editor: rich text (WYSIWYG) vs plain/markdown-lite | Ph 26 |
| 7 | Heart / "Add to Collection" — what should they mean on a single-owner site? *(Phase 19 ships without them.)* Breadcrumb "model line" level — wanted? *(no data; crumb is `Collection › Brand › Model`)* | Ph 20 |
| 8 | ~~Corvette / scale~~ → **merge Corvette into Chevrolet**; **all 227 are 1:43** (Phase 4) | Ph 4 / 7 |
| 9 | ~~npm or pnpm~~ → **npm** (decided in Phase 2) | Ph 2 |
| 10 | Supabase plan (free projects pause after inactivity) — pay, or keep-alive ping? *Project is on the free plan (second account); decide before launch* | Ph 5 / 37 |
| 11 | Assets: header logo (SVG preferred), hero background image | Ph 12, 17 |
| 12 | **D15**: manufacturer "DTM" (3 BMW/Mercedes models) is a race series, not a model maker. Keep, or give the real manufacturers? | Ph 7 |
