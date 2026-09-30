# Supabase Setup

How the app connects to Supabase, and the one-time steps only the owner can do.

## Hosting (decided 2026-09-27)

| Topic | Decision |
| --- | --- |
| Project | Dedicated project **`zemaking-diecast-car-collection`** in the owner's **second** Supabase account (signed in with the second GitHub account). The main account's two free slots stay with recipes and games |
| Schema | All app objects live in the Postgres schema **`diecast`**, not `public`. The client uses `db: { schema: 'diecast' }` (`src/lib/supabase.ts`). This keeps a future move (`pg_dump --schema=diecast`) or sharing trivial. The schema must be listed under **Data API → Exposed schemas** |
| Environments | Hosted project for development and production. The second account's remaining free slot is for the **E2E test project** (Phase 35). The **local Docker stack** (`npm run db:start`) is optional, and is the place to test migrations from scratch before pushing (Phase 6) |
| Migrations | Source of truth: `supabase/migrations/*.sql`. **The Phase 6 migrations were applied by hand in the dashboard SQL editor (2026-09-27)** because the owner prefers the web UI. Future migrations are applied the same way, in filename order, and the ROADMAP phase records which files ran. If the CLI is ever linked, first run `npx supabase migration repair --status applied 20260927140000 20260927140100 20260927140200` (plus any later versions already applied), or `db push` would try to re-run them. The GitHub integration "Deploy to production" remains an option later; it needs the CLI history repaired first |
| Client | One client in `src/lib/supabase.ts`. Only `src/lib` and `src/services` may import `@supabase/supabase-js` (ESLint rule in Phase 9). Own `storageKey` (`zk-diecast-auth`) |
| Keys in the browser | Only the **anon / publishable** key (`VITE_SUPABASE_ANON_KEY`). `src/lib/env.ts` throws on a secret or service_role key, and `postbuild` fails the build if one reaches `dist/` |
| Service-role key | Local scripts only (Phases 7, 8, 21), from `.env.local` or the shell. Never `VITE_`-prefixed, never committed, never in Vercel |
| Secrets in chat | Never paste passwords or secret keys into chat or commit them. The database password is typed only into the CLI prompt |
| Errors | Everything goes through `toAppError()` (`src/lib/errors.ts`), which gives one of: `network`, `unavailable`, `auth`, `permission`, `not_found`, `conflict`, `validation`, `config`, `unknown` |
| Types | `src/lib/database.types.ts` is **hand-written from the migrations** in the exact `supabase gen types` format, because the CLI isn't linked. `npm run verify:types` checks every column against the live DB (as admin). Update it with every migration, or regenerate with `npm run db:types` once the CLI is linked |
| Free-plan pause | The project pauses after about 7 days without traffic, and the site then shows the "temporarily unavailable" state. Decide on a paid plan or a keep-alive before launch (Phase 37, open decision #10) |

## Owner steps

### 1. Connect the app
1. Dashboard (second account) → **zemaking-diecast-car-collection → Project Settings → API** (or the **Connect** button).
2. Copy `.env.example` to `.env.local` in the repo root and fill in:
   - `VITE_SUPABASE_URL`: the Project URL, `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: the **anon public** key (`eyJ…`) or **publishable** key (`sb_publishable_…`). **Not** `service_role` / `sb_secret_…`.
3. Check the connection:
   ```bash
   npm run supabase:check
   ```
   Expected output: `✓ Connected to https://<ref>.supabase.co in N ms`. `npm run dev` also logs `[supabase] connected …` in the browser console.

### 2. Auth settings (Authentication → Sign In / Providers)
- Turn **off "Allow new users to sign up"**. This is an owner-only site; the owner user is created by hand in Phase 6.

### 3. Apply migrations (SQL Editor)
For each new file in `supabase/migrations/`, in filename order: paste the whole file into **SQL Editor → New query → Run**. Never re-run a file that already succeeded. If one fails, stop and report the error.

### 4. Owner admin account
- Authentication → Users → **Add user** (Auto Confirm) for the owner.
- SQL Editor: `insert into diecast.admin_users (user_id) select id from auth.users where email = '<owner-email>';`
- Current admin: 1 row (the owner), verified 2026-09-27.

### 5. RLS verification (after every migration that touches tables or policies)
Needs `RLS_ADMIN_EMAIL/PASSWORD` (the owner) and `RLS_USER_EMAIL/PASSWORD` (a separate **non-admin** test user) in `.env.local`.
```bash
npm run verify:rls
```
75 checks: anon and a non-admin user can read only published models, their children and lookups; they can't see drafts, private notes or the admin list; every INSERT/UPDATE/DELETE is denied; the admin can do everything except write `admin_users` through the API. The script creates temporary `zz-rls-*` rows as admin and deletes them again. Since Phase 21 it also proves the `model-images` bucket (12 of the 75): anon/user can't upload, overwrite, delete or list, the admin can, non-image types are rejected, and the public URL serves (temporary objects under `zz-rls/`, deleted again).
```bash
npm run verify:types
```
Checks `database.types.ts` against the live schema.

### (Optional) Link the CLI
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```
Log in with the **second** account. `link` asks for the database password; type it into the prompt only.

### Exposed schema
Project Settings → **Data API → Exposed schemas** includes `diecast` (done 2026-09-27).

### 6. Storage (Phase 21)
Bucket `model-images` (public read, admin-only writes, WebP/PNG/JPEG up to 5 MB) is created by migration `20260930120000_diecast_storage.sql`. Moving the images there is a local, service-role run: see [`scripts/migrate-images/README.md`](../scripts/migrate-images/README.md) (upload → verify → flip, and the rollback).

### 7. Vercel (Phase 10 / 37)
Add the same two `VITE_` variables to Vercel when the site starts reading from Supabase (Phase 10). Until then production doesn't need them: nothing in the shipped UI imports the client.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run supabase:check` | Checks `.env.local` against `/auth/v1/health` (URL reachable + key accepted) |
| `npm run build` → `postbuild` | Scans `dist/` for service_role JWTs, `sb_secret_` keys and `SUPABASE_SERVICE_ROLE_KEY`, and fails the build if found |
| `npm run import:cars` | JSON → Supabase import (dry run by default; `-- --apply` writes in one transaction). See `scripts/import/README.md`. Needs `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run verify:rls` | Live RLS + Storage policy proof as anon / non-admin / admin (75 checks) |
| `npm run images:migrate` | postimg → WebP → Storage (dry run by default; `-- --apply` uploads, resumable). See `scripts/migrate-images/README.md`. Needs `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run images:check` | Every uploaded object vs the manifest (`-- --full`: sha256 + dimensions) |
| `npm run images:flip` | Verifies, then points `model_images` at Storage in one transaction (dry run by default; `-- --rollback` undoes it) |
| `npm run images:verify` | Every image row resolves like the app does and answers HEAD 200; spot checks; `-- --legacy` checks the postimg rollback URLs |
| `npm run verify:types` | Checks `database.types.ts` columns against the live schema |
| `npm run db:push` | CLI-only alternative to the SQL editor; **repair the history first** (see Migrations) |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` for schema `diecast` (`db:types:local` for the Docker stack) |
| `npm run db:start` / `db:stop` | Starts/stops the optional local stack (Docker). `diecast` is exposed there via `supabase/config.toml` |
