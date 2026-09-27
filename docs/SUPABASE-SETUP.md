# Supabase Setup

How the app connects to Supabase, and the one-time steps only the owner can do.

## Hosting (decided 2026-09-27)

| Topic | Decision |
| --- | --- |
| Project | Dedicated project **`zemaking-diecast-car-collection`** in the owner's **second** Supabase account (signed in with the second GitHub account). The main account's two free slots stay with recipes and games |
| Schema | All app objects live in the Postgres schema **`diecast`**, not `public`. The client uses `db: { schema: 'diecast' }` (`src/lib/supabase.ts`). This keeps a future move (`pg_dump --schema=diecast`) or sharing trivial. The schema must be listed under **Data API → Exposed schemas** |
| Environments | Hosted project for development and production. The second account's remaining free slot is for the **E2E test project** (Phase 35). The **local Docker stack** (`npm run db:start`) is optional, and is the place to test migrations from scratch before pushing (Phase 6) |
| Migrations | `supabase/migrations/*`, applied with `npm run db:push` first. Once the schema is stable (end of Phase 6), optionally the **GitHub integration** "Deploy to production" (free plan) takes over. This repo is on the *main* GitHub account, so the second account needs access to it, e.g. as a collaborator plus the Supabase GitHub app installed on the repo |
| Client | One client in `src/lib/supabase.ts`. Only `src/lib` and `src/services` may import `@supabase/supabase-js` (ESLint rule in Phase 9). Own `storageKey` (`zk-diecast-auth`) |
| Keys in the browser | Only the **anon / publishable** key (`VITE_SUPABASE_ANON_KEY`). `src/lib/env.ts` throws on a secret or service_role key, and `postbuild` fails the build if one reaches `dist/` |
| Service-role key | Local scripts only (Phases 7, 8, 21), from `.env.local` or the shell. Never `VITE_`-prefixed, never committed, never in Vercel |
| Secrets in chat | Never paste passwords or secret keys into chat or commit them. The database password is typed only into the CLI prompt |
| Errors | Everything goes through `toAppError()` (`src/lib/errors.ts`), which gives one of: `network`, `unavailable`, `auth`, `permission`, `not_found`, `conflict`, `validation`, `config`, `unknown` |
| Types | `npm run db:types` generates `src/lib/database.types.ts` for the `diecast` schema once tables exist (Phase 6). Placeholder until then |
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

### 3. Link the CLI (needed from Phase 6)
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```
Log in with the **second** account. `link` asks for the database password; type it into the prompt only.

### 4. Expose the schema (Phase 6, after the first migration)
Project Settings → **Data API → Exposed schemas**: add `diecast`.

### 5. Vercel (Phase 10 / 37)
Add the same two `VITE_` variables to Vercel when the site starts reading from Supabase (Phase 10). Until then production doesn't need them: nothing in the shipped UI imports the client.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run supabase:check` | Checks `.env.local` against `/auth/v1/health` (URL reachable + key accepted) |
| `npm run build` → `postbuild` | Scans `dist/` for service_role JWTs, `sb_secret_` keys and `SUPABASE_SERVICE_ROLE_KEY`, and fails the build if found |
| `npm run db:push` | Applies `supabase/migrations/*` to the linked project (Phase 6) |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` for schema `diecast` (`db:types:local` for the Docker stack) |
| `npm run db:start` / `db:stop` | Starts/stops the optional local stack (Docker). `diecast` is exposed there via `supabase/config.toml` |
