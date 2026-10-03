# Performance (ROADMAP Phase 33)

Measured 2026-10-03 with `npm run perf:vitals` (`scripts/perf/vitals.mjs`): production build on `vite preview`, headless Edge, cold cache, medians of 5 runs, real Supabase project.
- **mobile**: 412×823 @1.75x, 4× CPU slowdown, 150 ms RTT / 1.6 Mbps.
- **desktop**: 1350×940, no CPU slowdown, 40 ms / 10 Mbps.

Throttling is applied by DevTools, so compare these numbers with each other, not with PageSpeed Insights. Supabase over the internet adds ±150 ms of noise to anything that waits on data.

## Targets

| Metric | Target | Result |
| --- | --- | --- |
| LCP | ≤ 2.5 s | desktop ✅ (≤ 1.4 s); **mobile/slow 4G ~2.9 s on the collection and details pages — accepted** (see below) |
| CLS | ≤ 0.1 | ✅ ≤ 0.008 everywhere (was 0.066) |
| TBT (lab stand-in for INP) | ≤ 200 ms | ✅ ≤ 147 ms |
| Initial JS | ≤ 180 kB gzip | ✅ 175 kB (was 190 kB) |

## Before / after

| Profile | Route | FCP | LCP | CLS | TBT | Requests | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mobile | `/` | 1552 → **1484** | 3916 → **2912** | 0.066 → **0.002** | 159 → 147 | 84 → **29** | 725 → **469 kB** |
| mobile | `/models/…` | 1512 → 1436 | 3740 → **2904** | 0.002 → 0.008 | 0 → 0 | 21 → 23 | 461 → 420 kB |
| mobile | `/brands` | 1532 → 1476 | 1532 → 1476 | 0.002 | 18 → 19 | 55 → 29 | 459 → 341 kB |
| mobile | `/statistics` | 1532 → 1440 | 1532 → 1440 | 0.002 | 32 → 28 | 31 → 33 | 387 → 347 kB |
| desktop | `/` | 424 → 332 | 1424 → 1416 | 0.056 → **0.002** | 0 | 114 → 80 | 1336 → 1134 kB |
| desktop | `/models/…` | 464 → 332 | 1520 → 1396 | 0.001 | 0 | 21 → 23 | 461 → 420 kB |
| desktop | `/brands` | 372 → 332 | 372 → 332 | 0.001 | 0 | 55 → 57 | 459 → 404 kB |
| desktop | `/statistics` | 468 → 328 | 468 → 328 | 0.001 | 0 | 31 → 33 | 387 → 347 kB |

Times in ms. The `/models/…` route is `porsche-911-gt3-rs-2003-altaya-white`.

**Bundle**: 664 kB min / 194 kB gzip in one chunk → 605 kB / 177 kB (+ font files, loaded per script) in `index` (app, 34 kB gz) + `react` (92) + `supabase` (41) + `query` (10).

**`getModels()` payload**: 275 kB raw / 34.5 kB on the wire → 239 kB / 28.2 kB. API time ~200 ms from here (a trivial query takes ~100 ms).

## What changed

1. **Fonts self-hosted** (`@fontsource-variable/nunito-sans`, weight axis only). Before: a render-blocking stylesheet from fonts.googleapis.com, then ~180 kB of fonts from fonts.gstatic.com, which competed with the photos. Now: ~31 kB per subset, same origin. **Not preloaded**: with a preload, mobile FCP was ~140 ms worse (it competed with the JS), and CLS was no better.
2. **Supabase preconnect** in `index.html` (both the CORS pool and the plain-image pool).
3. **The summary list starts loading before the first render** (`main.tsx` prefetches `modelSummariesQuery`; all six readers now share that one definition).
4. **Summary payload trimmed**: `getModels()` selects `SUMMARY_COLUMNS`. Dropped `id` (unused UUIDs were 6 kB of the 30 kB gzip), `is_published`, `created_at`, `updated_at`.
5. **Details page in one round trip**: the colors, images and tags queries filter by slug through `model:models!inner()` and run in parallel with the model query. Before, they waited for the model's id.
6. **Image priorities**: the first 4 items of a list load eagerly with `fetchPriority="high"` (one of them is the LCP). The main photo on the details page / Quick View is high priority. Brand and manufacturer logos are lazy (before, the grid fetched about 40 distinct logo SVGs before the photos).
7. **CLS fix (hero)**: Phase 29's `.skeleton[aria-hidden] { display: block }` outranked the count placeholder's `inline-block`. While loading, the title was two lines, then dropped to one, so everything shifted 29 px. The placeholder is now inline, 1.75em wide (the width of "227"), and the hero text column fills the row.
8. **Realtime stub**: `@supabase/realtime-js` is aliased to `src/lib/realtime-stub.ts`, saving ~57 kB min / ~15 kB gzip. The app never opens a channel. A contract test reads the installed supabase-js and fails if an upgrade calls something the stub lacks.
9. **Caching**: vendor chunks are split out. `vercel.json` serves `/assets/*` (hashed) as `immutable` for a year. Before, Vercel revalidated them on every visit.

## Decisions (from measurements)

- **No pagination or virtualization.** Rendering all 227 cards is one ~200 ms task at 4× CPU slowdown (~50 ms on a real phone), and TBT stays under 200 ms. Revisit at ~1,500 models or if TBT goes over 200 ms. **No extra memoization**: profiling shows no other cost, and the collection pipeline is already `useMemo`'d.
- **No route-level code splitting of public pages.** All of them together are ~12 kB gzip (~60 ms on slow 4G). A lazy chunk would add a round trip to every shared details link. Admin pages were already split.
- **Image sizes**: thumbnails (400 w) are already at or below display size on every layout. Card boxes are `aspect-ratio: 4/3` and gallery images carry `width`/`height`, so loading causes no CLS. No `srcset`: the only larger variant is 1600 w, which would cost up to 4× the egress on the Free plan.
- **Remaining mobile LCP (~2.9 s)** is the chain JS (175 kB, ~0.9 s at 1.6 Mbps) → summaries (CORS preflight + GET, ~0.5–0.7 s) → photo. That is inherent to a client-rendered app reading a remote DB. **Accepted.** Options if the owner wants it lower:
  - an 800 px image variant: the details LCP photo would drop from 133 kB to ~45 kB (est.). Needs a Storage migration and a quota check.
  - server-side rendering or a static snapshot of the summary list.
- **CORS preflight**: every distinct REST URL costs one OPTIONS round trip on a first visit (`max-age` 3600). supabase-js's headers (`apikey`, `Authorization`, `Accept-Profile`) make it unavoidable.

## Database

Indexes cover every per-model lookup: `models.slug` is UNIQUE, and each child table's key starts with `model_id`. At ~230 rows the planner uses sequential scans for the list, which is correct. `supabase/checks/performance.sql` has the `EXPLAIN (ANALYZE)` statements for the app's reads, run as `anon`. **Owner: run it once in the SQL editor** (Claude has no SQL access) and confirm single-digit-ms execution.
