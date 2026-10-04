# ZemaKing Diecast Collection

A showcase of a personal collection of 1:43 diecast model cars: browse, filter, search and sort the collection, open a model's details and photos, and browse by brand or manufacturer, with statistics on the whole set. The owner signs in to add, edit and delete models, their photos and the supporting data.

React 19 + TypeScript + Vite single-page app. Supabase (Postgres, Auth and Storage) is the only backend. It is deployed on Vercel.

## Getting started

Requirements: Node 22.12 or newer (developed on Node 24) and npm. Use npm only: `package-lock.json` is the lockfile, and pnpm/yarn lockfiles are git-ignored.

```bash
npm ci
```

Copy `.env.example` to `.env.local` and fill in the two browser variables from the Supabase dashboard (Project Settings → API):

| Variable | What |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **public** anon (`eyJ…`) or publishable (`sb_publishable_…`) key. The app refuses to start with a secret or service_role key |

The optional variables in `.env.example` are for local scripts only. They include `SUPABASE_SERVICE_ROLE_KEY` for the import and image tools, and the `RLS_*` logins for `verify:rls`. Never give them a `VITE_` prefix: only `VITE_*` variables reach the browser, and the build fails if a secret key ends up in `dist/`.

```bash
npm run dev
```

More detail, including the owner's one-time Supabase steps, is in [`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (opens the browser). `/dev/tokens` shows every design token |
| `npm run build` | Type-check (`tsc -b`) and production build, then a scan of `dist/` for secret keys |
| `npm run preview` | Serves the production build on port 4173 |
| `npm run typecheck` / `npm run lint` | `tsc -b` / ESLint over the whole repo |
| `npm test` | Vitest unit and component tests (`npm run test:watch` to watch) |
| `npm run test:e2e` | Playwright end-to-end suite against the built app, using the locally installed Edge. It is **read-only** against the live project. See [`e2e/README.md`](e2e/README.md) |
| `npm run a11y:axe` | axe-core audit of every page and dialog in both themes and two viewports. Needs `npm run preview` running. See [`docs/accessibility.md`](docs/accessibility.md) |
| `npm run perf:vitals` | Lab Web Vitals of the production build. Needs `npm run preview` running. See [`docs/performance.md`](docs/performance.md) |
| `npm run supabase:check` | Checks that `.env.local` reaches the project |
| `npm run verify:types` | Checks `src/lib/database.types.ts` against the live schema |
| `npm run verify:rls` | Proves the row-level security and Storage policies as anon, a normal user and the admin. Needs the `RLS_*` logins |
| `npm run verify:stats` | Recounts every Statistics-page number from the base tables |
| `npm run verify:model-form` | Runs every model through the admin form's save path as a dry run |
| `npm run backup:export` | Read-only export of every table (and with `-- --photos`, every Storage file) to the git-ignored `backups/` folder. See [`scripts/backup/README.md`](scripts/backup/README.md) |
| `npm run icons` | Regenerates the PWA icons and favicon from `public/favicon.svg` |

The one-time migration tools are kept for reference and rollback: `import:cars` and `verify:migration` (JSON → Supabase, see [`scripts/import/README.md`](scripts/import/README.md)), and `images:*` (postimg → Storage, see [`scripts/migrate-images/README.md`](scripts/migrate-images/README.md)). **Don't run `npm run import:cars -- --apply` again**: it would overwrite edits made in the admin UI with the frozen JSON snapshot.

## Managing the collection

Models are managed in the app, not in files.

1. Go to `/login` and sign in with the owner account. Sign-ups are off; accounts are created in the Supabase dashboard, and admins are listed in `diecast.admin_users`.
2. `/admin` → **+ Add Model** opens the form. To change or remove a model, use **Edit** / **Delete** on its details page. Photos are resized in the browser and uploaded to Storage when you save. **Save as Draft** keeps a model off the public site.
3. Brands, manufacturers, drivers, tags, colors and categories are on `/admin/data`. A brand or manufacturer logo is either an SVG in `public/brands/` / `public/manufacturers/` or a file uploaded in its dialog.

The browser only ever holds the public key. Every write is checked by the database's row-level security, so hiding admin buttons is only a convenience. A model's address (`/models/<slug>`) is fixed when it is created.

## Project layout

```
src/
  pages/        one folder per route (collection, model details, browse, statistics, admin, …)
  components/   shared UI, each with its own .css file
  hooks/        React hooks (URL query state, session, dialogs, focus, …)
  services/     the only code that talks to Supabase (plus pure query/stats logic)
  lib/          the single Supabase client, env validation, error normalization
  utils/        pure, unit-tested helpers
  styles/       styles.css holds every design token
supabase/       SQL migrations (applied in the dashboard SQL editor) and check queries
scripts/        verification, import, image and audit tools (run with Node/tsx)
e2e/            Playwright tests
docs/           schema, Supabase setup, design tokens, accessibility, performance
archive/        retired data (the old truck gallery's JSON), not used by the app
```

`src/data/car-models.json` is the frozen 2026-09-28 snapshot the database was imported from. It is kept as a test fixture and a backup, and the app never reads it.

## Documentation

- [`docs/SCHEMA.md`](docs/SCHEMA.md): the database schema (everything lives in the `diecast` schema)
- [`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md): project setup, keys, migrations and scripts
- [`docs/DESIGN-TOKENS.md`](docs/DESIGN-TOKENS.md): design tokens, breakpoints, loading/empty/error states
- [`docs/accessibility.md`](docs/accessibility.md) and [`docs/performance.md`](docs/performance.md): targets, results and accepted limits
- [`ROADMAP.md`](ROADMAP.md): the redesign and migration, phase by phase
- [`CLAUDE.md`](CLAUDE.md): architecture notes and conventions for contributors (and for Claude Code)

## Deployment

Vercel builds with `npm run build` and serves `dist/`. `vercel.json` rewrites every path to the SPA and caches the hashed `/assets/*` files for a year. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project. Nothing else belongs there.

Production is https://diecast-collection.vercel.app. Every push to `main` deploys it. The release gate (check a preview first), the rollback plan and the backup routine are in [`docs/production-verification.md`](docs/production-verification.md).
