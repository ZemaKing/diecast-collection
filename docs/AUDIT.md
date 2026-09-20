# Current Application Audit (Phase 1)

_Audited 2026-09-20 at commit `5ce1da0` (branch `main`, clean tree). Read-only — no application code was changed._

Companion to [`ROADMAP.md`](../ROADMAP.md).

---

## 1. Summary

A small, clean React 19 + TypeScript + Vite SPA (~1,900 lines across 28 source files, excluding the JSON data) with **no backend, no auth, no tests, no search, no sorting and no data-fetching layer**. All model data is two static JSON files imported directly into the bundle; all photos live on postimg.cc. The redesign therefore touches almost everything, but the codebase is small enough that "replace" is cheaper than "adapt" for most UI, while the small amount of domain logic (filter predicate, color rendering, theme) is worth carrying over.

There was **no prior roadmap** in this repo (only `README.md`, which is the untouched Vite template, and `CLAUDE.md`). Phase numbering therefore starts at 1.

## 2. Stack and tooling

| Area | Current state |
| --- | --- |
| Runtime | React 19.2, react-router-dom 7.14 (`BrowserRouter`), TypeScript 5.9 (strict, `noUnusedLocals`, `erasableSyntaxOnly`), Vite 7 |
| Styling | Plain CSS, one co-located `.css` per component/page, global tokens in `src/styles/styles.css`. No CSS framework/modules |
| Font | Jost via Google Fonts `<link>` in `index.html` |
| Lint | ESLint 9 flat config (typescript-eslint, react-hooks, react-refresh) |
| Tests | **None** — no runner, no scripts, no test files |
| Deploy | Vercel; `vercel.json` rewrites every path to `/` (SPA fallback) |
| Dependencies | Only `react`, `react-dom`, `react-router-dom` at runtime — no state, data-fetching, form, or UI libraries |
| Package manager | `package-lock.json` is committed, but `node_modules/.pnpm/` exists locally → npm/pnpm mix (decide in Phase 2) |
| Env | No `.env` usage anywhere; `.gitignore` already ignores `*.local` (good for `.env.local`) |

## 3. Routes

| Path | Renders | Notes |
| --- | --- | --- |
| `/` | `LandingPage` | "Choose your collection": two image cards (Cars / Trucks) + theme toggle |
| `/cars` | `CollectionPage type="cars"` | |
| `/trucks` | `CollectionPage type="trucks"` | **Removed in redesign** |
| `*` | `<Navigate to="/" replace>` | No 404 page |

Query params in use: `brand`, `manufacturer`, `category`, `color` (filters; single value each, **display names** e.g. `brand=Citroën`) and `model=<id>` (opens details modal). Shared links of the form `/cars?model=<id>` exist in the wild → must keep working (redirect) after the redesign.

## 4. Components and pages

| File | Role | Verdict |
| --- | --- | --- |
| `pages/collection-page/collection-page.tsx` (190 lines) | Filter state, filtered list, `?model=` ↔ modal sync, scroll-to-card timeouts, scroll-to-top button | **Replace** (logic reshaped in Phases 9, 13, 17) |
| `components/Sidebar/Sidebar.tsx` (189) | Four `<select>` filters + Clear; mirrors state to URL via effects | **Replace** (toolbar + filter panel). Reuse: `uniqSorted`, `getFilterOptions` ideas |
| `components/ModelCard/ModelCard.tsx` (73) | Thumbnail, manufacturer logo, scale badge, `#number`, driver pill (+ flag emoji), title + color circle, meta row | **Rework** in Phase 16. Reuse: conditional racing block, color circle, badge concepts |
| `components/DetailsModal/DetailsModal.tsx` (141) | Modal with big image, fullscreen overlay, spec rows | **Replace** with details page + Quick View (Phases 19–20) |
| `components/Header/Header.tsx` (41) | Title link, "N models" pill, theme toggle, Instagram, email | **Replace** (Phase 12). Reuse: social links, count pill idea |
| `components/CategoryLabel` | Colored text via hard-coded `Category → hex` map | **Replace**; colors move to tokens (Phase 3) |
| `components/ColorCircle` | Single color or `conic-gradient` for multi-color | **Reuse** (restyle) |
| `components/ThemeToggle` + `hooks/useTheme.ts` | Light/dark, `localStorage["zk-theme"]`, pre-paint script in `index.html` | **Reuse** as-is |
| `pages/landing-page` | Cars/Trucks chooser | **Remove** (Phase 11) |
| `icons/*` | 4 inline SVG components | Reuse; extend as needed |

## 5. State management and data flow

There is no store. The flow today:

```
car-models.json / truck-models.json  (bundled at build time, cast `as DiecastModel[]`)
        │
CollectionPage ── useMemo(models by `type`) ──► Sidebar (derives option lists, owns filter state)
        │                                            │  effect: URL → state, state → URL, state → parent
        ├── filteredModels (useMemo predicate) ◄─────┘
        ├── ModelCard × N
        └── DetailsModal ◄── modelFromUrl (from ?model=) + isModalOpen (local state)
```

Findings:

- **Filter state is duplicated and synced by effects three ways** (`Sidebar` local state ↔ URL ↔ `CollectionPage` state via `onFiltersChange`). It works, but it is the most fragile code in the app. Redesign should make the URL the single source of truth (Phase 13).
- **Modal open/close is driven by timeouts** (150 ms + 450 ms after `scrollIntoView`) and a `lastOpenedModelIdRef` guard. This exists only because the details view is a modal over a scrolling grid; a real details route (Phase 19) removes it.
- `getModelById` is a linear scan over the array; irrelevant at this scale.
- Data is synchronous. Moving to Supabase makes every read async → loading/error states become mandatory (introduced minimally in Phase 10, consolidated in Phase 29).

## 6. Data sources and model schema

### 6.1 Where JSON is used at runtime

Only one place: `collection-page.tsx:10-11` (`import carModelsData`, `import truckModelsData`). Nothing else reads `src/data/*.json`. This makes the eventual cut-over small and easy to verify.

### 6.2 Type vs. reality

`src/types.ts` declares `DiecastModel` with: `id, name, year, brand, manufacturer, category, carNumber?, carDriver?, driverCountry?, color[], hex?[], thumbnail, imageUrl, scale?`. JSON is force-cast, with no runtime validation.

### 6.3 Dataset profile (cars — the only collection that survives the redesign)

| Metric | Value |
| --- | --- |
| Models | **227** (matches the "227 models" in the mockups) |
| Brands | 46 (Ford 22, Porsche 14, Ferrari 13, Mitsubishi 13, …) |
| Manufacturers | 19 (Altaya 130, Ixo 29, Burago 10, Atlas 9, DeAgostini 8, …) |
| Categories | 5 — Rally 98, Racing 84, Supercar 19, Premium 18, Retro 8 |
| Color names | 13 — White 54, Red 33, Blue 28, **MULTI 26**, Gray 23, Black 23, Yellow 22, … |
| Years | 1969 – 2023 |
| Duplicate ids | 0 (ids are unique slugs) |
| Image URLs | 454 (thumbnail + full per model), all `i.postimg.cc`, 0 duplicates, 0 placeholders |
| Trucks (out of scope) | 39 records, 21 brands, 2 manufacturers (DeAgostini 38, NewRay 1) |

### 6.4 Data quality findings (drive the schema and the import tool)

| # | Finding | Impact / proposed handling |
| --- | --- | --- |
| D1 | **`scale` is absent from all 227 records**; UI silently defaults to `"1:43"` in two places | Column `scale` default `'1:43'`; import fills explicitly. Confirm with owner that all 227 are 1:43 |
| D2 | **`driverCountry` is absent from all records**, yet the type and card render a flag emoji | Flag feature is dead today. `drivers.country_code` nullable; backfill is optional, later |
| D3 | **`hex` ≠ `color` semantically.** `color[]` = filter names (1–3), `hex[]` = livery palette (1–4). Counts differ for 165/227 models; e.g. `color:["Black","Gold"]` with a single hex | Keep both concepts: `model_colors` (filter) and `livery_hex text[]` (swatch). Don't force 1:1 |
| D4 | **`MULTI`** is a color name on 26 models (all with 3 hex values) | Real filter facet today. Keep as a color row (`Multi`), render as conic swatch |
| D5 | Driver names have **duplicates/typos**: `Sébastien Loeb`/`Sebastien Loeb`, `François Delecour`/`Francois Delecour`, `Sébatien Ogier` (typo) vs `Sébastien Ogier`, `Marcel Fässler`/`Marcel Faessler`, `Augusto Farfus`/`Augusto Farfus Júnior`; two names use U+2011 non-breaking hyphens (`Jean‑Karl Verney`, `Jean‑Pierre Fontenay`) | 143 distinct strings → ~138 after merging 5 alias groups. Import uses an explicit, reviewed alias map |
| D6 | Fictional/nickname "drivers": `Edwin`, `Jesse`, `Suki`, `Davy Jones`, `Brian O'Conner` | Keep as drivers (they are on the livery); no country |
| D7 | `carNumber` without driver on 1 model (`mazda-rx-7-fd-…-red`, #3); driver without number on 2 (`Suki`, `Brian O'Conner`); 12 Rally/Racing models have neither | Racing block must tolerate any combination. `is_racing` cannot be derived from "has driver" alone |
| D8 | Stray key `COMING_SOON` on `abarth-124-rally-rgt-2017-altaya-green` (not in type, unused) | Not imported. Signals an intended "image coming soon" placeholder → use for missing-image fallback (Phase 29) |
| D9 | `Corvette` is a **separate brand** from `Chevrolet` (one model: C5-R); `Land Rover` model has id prefix `range-rover-sport-…` | Preserve as-is; flag brand merge as an owner decision, don't auto-merge |
| D10 | One name/year/manufacturer/color tuple appears twice (`Porsche 911 GT3 R 2019 Ixo MULTI`: #1 and #69) | Legitimate variants. **Uniqueness key must be `slug`, never a name tuple** |
| D11 | ids are slugs of `brand-model-year-manufacturer-color`, but 16 don't end in `mfr-color` (multi-color naming drift) and 20 are out of alphabetical order | Preserve ids verbatim as `slug`; never regenerate. Ordering is irrelevant once DB-backed |
| D12 | Image filenames: 1 thumbnail typo (`…-thumbail.png`), ~5 thumbnails/6 full images whose URL doesn't contain the model id | Harmless; URLs are opaque. Do not rely on filename patterns |
| D13 | **No "added" timestamp anywhere.** Git can date only ~23 models: **204 of 227 arrived in a single commit (2026-04-16)** | "Recently added" sort can't be truthful for 204 models. `added_at` nullable; backfill 23 from git, leave the rest NULL (or a sentinel), owner can edit later |
| D14 | Array order is the only ordering (no sort UI) | Sorting is new behavior (Phase 15) |

### 6.5 Fields the mockups need that **do not exist** in the data

`description`, key features, tags, **multiple images** (mockups show 8), condition, location, collected status, `added_at`, series/collection, team, race/event, private notes, favorite ("heart"), and a **draft/published** state ("Save as Draft"). All of these will be empty for the 227 migrated rows. The UI must render conditionally and must **not** ship fabricated placeholder content ("About this model" with lorem) for models that have none.

## 7. Image architecture

- Card: `<img src=thumbnail loading="lazy" decoding="async">` in a `4/3` `object-fit: contain` box (`min-width: 250px`).
- Details: single `imageUrl` + click-to-fullscreen overlay. No gallery, no srcset, no `width/height` attributes (CLS risk mitigated only by the aspect-ratio box).
- Hosting: postimg.cc (free third-party image host, no SLA). Sampling 9 models: full ≈ 865 KB avg, thumbnail ≈ 177 KB avg → **~190 MB full + ~40 MB thumbs ≈ 230 MB** for 227 models (estimate; fits the Supabase free 1 GB storage). During auditing, 6 of 18 sampled HEAD requests failed transiently — the Storage migration script needs retries/resume.
- Logos: `public/brands/{brand}.svg` (63 files, referenced by **raw display name**, incl. `Citroën.svg`, `Škoda.svg`, `Żubr.svg`) and `public/manufacturers/{manufacturer}.svg` (19 + `Leo Models.svg` with a space). All 46 car brands and 19 car manufacturers have a logo; ~17 brand SVGs are truck-only and become unused. `NewRay.svg` is missing (truck-only, irrelevant). Extras: `public/wheel.svg` (driver icon), `favicon.ico`.
- `public/cars-logo.png` (687 KB) is the sidebar logo; `trucks-logo.png` (740 KB) is a landing image. The mockup header uses a "ZemaKing — DIECAST COLLECTION" wordmark with the wheel/crown badge → needs an optimized (SVG/WebP) asset from the owner.

## 8. Filtering, sorting, search

- **Filters**: brand, manufacturer, category, color — each a single-select `<select>` with an "All" option, AND-combined. Color matches if any of the model's color names equals the selection. Options are derived from the (unfiltered) list, sorted with `localeCompare`; **no counts, no faceting** (options don't narrow based on other filters).
- **Sorting**: none (JSON order).
- **Search**: none.
- **Empty state**: one text line.
- **Persistence**: filters ↔ URL (`replace: true`); modal ↔ `?model=` (`push`).

## 9. Authentication / admin

None. There is no login, no admin UI, and no write path. Adding a model = hand-editing JSON + committing (81 of 174 commits are `New Car(s)/Truck: …`). The mockup's avatar "ZK" and Add/Edit screens introduce auth and CRUD from scratch.

## 10. Responsive implementation

- Breakpoints in use are **inconsistent**: 600 (modal), 640, 768 (landing), 1024, 1280, 1500, 1800 — no shared source.
- Grid: 1 col → 2 (≥640) → 3 (≥1280) → 4 (≥1500) → 5 (≥1800). Sidebar becomes a sticky 280 px column at ≥1024; below that it stacks above the grid as 1/4-column selects.
- `html, body { overflow-x: hidden }` **masks horizontal-overflow bugs** — it must be removed (and overflow fixed properly) during the responsive passes.
- `.thumb { min-width: 250px }` forces a minimum card width.
- Touch/mobile: no drawers, no hamburger, no touch-target sizing, no swipe. Modal switches layout at 600 px.

## 11. Technical debt relevant to the redesign

1. Effect-based triple sync of filter state (see §5).
2. Timeout-driven scroll-then-open modal logic.
3. Accessibility: the card is a non-focusable `div` with an `onClick` on the inner `<img>`; modal has `role="dialog"` but **no focus trap or focus restore**; icon-only buttons rely on glyph characters (`✕`, `⛶`, `˄`).
4. `Category` type is defined in two places and disagrees with `DiecastModel.category` (`types.ts` lists 4 of the 9 values in data). Moot after Supabase types.
5. Category colors hard-coded in a TSX map; gold accent exists only as `--pill-accent` while `--accent` is green.
6. `.countPillTotal` relies on `!important`; `countPill` styles live in `Sidebar.css` but are used by `Header`/`ThemeToggle`.
7. Header logo hover uses a leftover Vite template `drop-shadow` (`.logo.react`).
8. `README.md` is the Vite template boilerplate. `CLAUDE.md` describes the JSON architecture and will need rewriting.
9. Two heavy PNG logos in `public/` (≈1.4 MB).
10. No env typing, no error boundary, no 404 page, no loading states (none were needed).

## 12. What to reuse vs. replace

**Reuse:** theme mechanism (`useTheme`, `ThemeToggle`, pre-paint script), token approach in `styles.css` (extend, don't restart), `ColorCircle`, brand/manufacturer SVG logos, wheel icon, the conditional racing-badge idea, the deep-link-friendly slug ids, the `new URLSearchParams(searchParams)` merge pattern, Jost, Vercel SPA rewrite.

**Replace:** landing page, Trucks route/data, Sidebar, Header, ModelCard markup/CSS, DetailsModal, CollectionPage orchestration, `CategoryLabel` color map, `types.ts`, JSON imports.

**New:** Supabase schema/RLS/client/services, auth, admin CRUD, image storage and gallery, search, sorting, view modes, details/manufacturer/brand/statistics/about pages, test infrastructure.

## 13. Mockup review (`diecast-details/`)

Three desktop-width (~1536 px) images were supplied:

- **`Mockup Overall.png`** — desktop collection page (header, hero "MY COLLECTION · 227 Diecast Models", toolbar with Filters / Brand / Manufacturer / Category / Color / Clear all / 3 view-mode icons / Sort, removable chips, 5-column card grid) plus small **insets**: Tablet (3 columns), Mobile (1 column, hamburger, search row, "Filters (2)" + "Sort"), Filters panel (searchable manufacturer list with counts and checkboxes; category pills), Showcase view (full-bleed hero carousel, "optional mode"), and a details-page preview.
- **`Mockup Details.png`** — desktop details page (breadcrumb, gallery with counter + fullscreen + thumbnail strip, spec tiles, tabs *Overview / Specifications / Gallery / My Collection / Notes*, key features, tags, My Collection card) plus **Quick View modal**, **Gallery lightbox**, **Info-panel modal alternative**.
- **`Diecast Create-Edit.png`** — desktop "Add New Model" (7 numbered sections, Cancel / Save as Draft / Save Model, image manager with primary + additional images, tags, live preview, completeness checklist).

### 13.1 Gaps that block or risk phases

1. **Tablet and Mobile exist only as small insets of the collection page.** There is no tablet/mobile details page, add/edit form, lightbox, or filter sheet. Phases 31–32 (and the responsive DoD of earlier phases) need dedicated references.
2. **No mockups at all** for: Manufacturers, Brands, Statistics, About, Login, supporting-data management, empty/loading/error states, hover/focus states, or the **light theme** (the mockup shows a theme toggle but only dark).
3. **Nav is inconsistent**: Overview shows *Collection · Manufacturers · Statistics · About*; Details/Create show *Collection · Manufacturers · **Brands** · Statistics · About* plus a "ZK" avatar.
4. **Breadcrumb has a "model line" level** (`Chevrolet › Corvette › Chevrolet Corvette Stingray`) that doesn't exist in the data.
5. **Concept-art artifacts**: "227 Diecas Models" (typo), "Nelloe" in the small quick-view, filter-panel categories "Road"/"Classic" that aren't in the data, and cards under an "Ixo + Racing" filter that show non-Ixo/non-Racing cars. Treat layout/hierarchy as the source of truth, not literal text.
6. **Privacy/RLS implications**: the public details page shows *Condition, Location, Added, Notes*, while the form labels a second field **"Notes (private)"**. Row Level Security is row-, not column-level, so private data needs a separate admin-only table (see ROADMAP Phase 4/6). Owner must decide which "My Collection" fields are public.
7. **Rich-text description** (B/I/U/lists/link toolbar) implies a WYSIWYG dependency and HTML sanitization; alternative is plain text/markdown-lite.
8. **Heart / "Add to Collection"** semantics are undefined for a public single-owner site (owner favorite? wishlist status?).
9. **Header logo asset** and hero background image (dark car silhouette) are not in the repo.
