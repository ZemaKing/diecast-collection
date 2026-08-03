# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React + TypeScript + Vite single-page app that showcases a personal diecast model collection ("ZemaKing Diecast Collection"), split into two galleries: Cars and Trucks. There is no backend — all model data lives in static JSON files and all images are hosted externally on postimg.cc.

## Commands

- `npm run dev` — start Vite dev server (opens browser automatically)
- `npm run build` — type-check (`tsc -b`) then production build via Vite
- `npm run lint` — run ESLint over the whole repo
- `npm run preview` — preview the production build locally

There is no test suite/runner configured in this repo.

## Architecture

**Routing** (`src/main.tsx`, `src/App.tsx`): `BrowserRouter` wraps a small `Routes` table — `/` is the landing page, `/cars` and `/trucks` both render `CollectionPage` with a `type` prop (`"cars" | "trucks"`), anything else redirects to `/`.

**Data model** (`src/types.ts`, `src/data/*.json`): Each collection is a flat JSON array of `DiecastModel` typed as `car-models.json` / `truck-models.json`, imported directly and cast with `as DiecastModel[]` — there is no runtime validation, so malformed entries fail silently or only surface as UI bugs.
- `id` is a slug of the form `{brand}-{model}-{year}-{manufacturer}-{color}`, used both as React key and as the DOM element id that deep-linking scrolls to (see below).
- `color`/`hex` are arrays because some models have multi-color liveries (rendered as a conic-gradient by `ColorCircle`).
- **Known inconsistency**: `DiecastModel.category` in `types.ts` only lists `"Rally" | "Racing" | "Supercar" | "Premium"`, but the JSON data and `CategoryLabel.tsx`'s local `Category` type also use `"Retro" | "Transport" | "Construction" | "Utility" | "Off-Road"`. Since data is force-cast, TypeScript won't catch new category values — when adding a model with a new category, update both `types.ts` and the `CATEGORY_COLOR` map in `CategoryLabel.tsx`.

**CollectionPage** (`src/pages/collection-page/collection-page.tsx`) is the core page: it holds filter state (`Sidebar`), renders the filtered grid (`ModelCard`), and drives `DetailsModal` off a `?model=<id>` URL query param rather than local state alone. Notable behavior baked in here:
- Filters (brand/manufacturer/category/color) are synced to the URL as query params by `Sidebar`, and the model id is synced by `CollectionPage` itself — both read/write `useSearchParams` independently, so changes to one must not clobber the other's params (see the `new URLSearchParams(searchParams)` merge pattern used everywhere).
- Opening a model via URL (e.g. a shared link, or a filtered link that doesn't have the card in view) scrolls the card into view before opening the modal, gated by timeouts and a `lastOpenedModelIdRef` to avoid re-triggering on every render.

**Adding new models**: this is the most common change (see git history — most commits are of the form `New Car(s): X`, `New Truck: Y`). To add one, append an object to `src/data/car-models.json` or `truck-models.json` matching `DiecastModel`, add a thumbnail + full image URL (currently all hosted on postimg.cc), and ensure a brand SVG exists at `public/brands/{brand}.svg` (used by both `ModelCard` and `DetailsModal`, matched by exact brand string).

**Styling**: plain CSS per-component (no CSS modules/Tailwind/styled-components) — each component/page has a co-located `.css` file imported directly, plus a shared `src/styles/styles.css` for globals.

**Deployment**: Vercel (`vercel.json` rewrites all paths to `/` to support client-side routing on refresh/deep links).