# Production Verification (Phase 37)

| | |
| --- | --- |
| Site | https://diecast-collection.vercel.app (Vercel, Git integration: every push to `main` deploys production; other branches get preview deployments) |
| Supabase | Project `zemaking-diecast-car-collection` (`gduqlrdjbhiftwzamtoe`), schema `diecast`, Free plan. The same project serves development, preview and production |
| Checked | 2026-10-04 |

## 1. Release gate

Run these before pushing to `main`. Steps marked *(owner)* need the owner signed in, by hand: Claude never types the owner's password.

1. `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all green locally.
2. Push the branch → Vercel builds a **preview**. Open it, then run `E2E_BASE_URL=<preview url> npm run test:e2e` (PowerShell: `$env:E2E_BASE_URL="<preview url>"; npm run test:e2e`). Preview URLs may be behind Vercel Deployment Protection; if so, check the preview by hand or turn on "Protection Bypass for Automation".
3. `node --env-file=.env.local scripts/check-bundle-secrets.mjs --url <preview url>` passes.
4. Merge/push to `main` → production. Repeat steps 2 and 3 with the production URL.
5. `npm run backup:export` after any release that came with data changes.

## 2. Automated checks against production

| Check | Result (2026-10-04) |
| --- | --- |
| Production bundle points at the right project | ✅ `index.html` preconnects to `gduqlrdjbhiftwzamtoe.supabase.co`, the same project as `.env.local` |
| No secret in what visitors download | ✅ `check-bundle-secrets.mjs --url https://diecast-collection.vercel.app`: 12 files (HTML, manifest, every JS/CSS asset), no service-role JWT, no `sb_secret_`, no literal service-role key |
| RLS + Storage policies (anon key = the one the site ships) | ✅ `npm run verify:rls`: 133/133. Anon and a non-admin user read only published data. Drafts, private notes and `admin_users` are hidden. Every write is denied. Both buckets are admin-write-only. Temporary `zz-rls-*` rows/files were removed afterwards |
| Types match the live schema | ✅ `npm run verify:types`: 13/13 relations |
| Statistics numbers | ✅ `npm run verify:stats`: 97/97 |
| Every model through the admin form (dry run) | ✅ `npm run verify:model-form`: 229/229 round-trip unchanged |
| Every image served from Storage | ✅ `npm run images:verify`: 227 image rows / 454 files, all HTTP 200 |
| Storage has no orphans | ✅ 454 files, all referenced by `model_images`; no folder without a model; no `zz-rls/` leftovers |
| SPA deep links + refresh | ✅ `/models/<slug>` answers 200 (rewrite to `/`); hashed `/assets/*` sent as `public, max-age=31536000, immutable` |
| E2E suite against production | ✅ `E2E_BASE_URL=https://diecast-collection.vercel.app npm run test:e2e`: 48 passed, 1 skipped (multi-photo paging; no model has 2+ photos yet), desktop 1280 + Pixel 7 |

## 3. Device checklist

✅ = verified, *(owner)* = needs the owner signed in. "E2E" = covered by the Playwright suite run against production; "pane" = checked by hand in the browser at that size.

| Journey | Desktop (1280) | Tablet (768) | Mobile (Pixel 7) |
| --- | --- | --- | --- |
| Collection loads (count, grid, no horizontal scroll) | ✅ E2E | ✅ pane | ✅ E2E |
| Search (`?q=`, header box) | ✅ E2E | ✅ pane (header) | ✅ E2E |
| Filters (panel / sheet, chips, Clear all, AND/OR) | ✅ E2E | ✅ pane (`?category=rally` → 98 + chip) | ✅ E2E (filter sheet) |
| Sort | ✅ E2E | ✅ pane (`?sort=year-desc`) | — |
| Model details (header, spec tiles, tabs, `?tab=`) | ✅ E2E | ✅ pane | ✅ E2E |
| Gallery + lightbox (open, Escape, image from Storage) | ✅ E2E | ✅ pane | — |
| Quick View | ✅ E2E | n/a (hover devices only) | n/a |
| Brands / Manufacturers / Statistics pages | ✅ E2E | — | ✅ E2E (drawer navigation) |
| Direct URLs + refresh, old `/cars` and `?model=` links | ✅ E2E + HTTP | — | — |
| 404 (unknown route, unknown model, unknown brand) | ✅ E2E | — | — |
| Login | *(owner)* | *(owner)* | *(owner)* |
| Create model (as a draft) | *(owner)* | — | *(owner)* |
| Edit model | *(owner)* | — | *(owner)* |
| Image upload | *(owner)* | — | *(owner)* |
| Delete model (the throwaway draft) | *(owner)* | — | — |

**Owner run (≈10 min, on the production site):** sign in → `/admin` → **+ Add Model** with obviously fake values (e.g. name "ZZ Test Car") → add one photo → **Save as Draft** → open it, **Edit** something, save → check the photo shows → **Delete** it. Do it once on desktop and the create/edit part once on a phone. Deleting the draft also removes its photos (best effort). If any `zz-test…` row or file is left over, tell Claude and it will list it with a read-only query.

## 4. Decisions

- **Free-plan pause: accepted** (owner, 2026-10-04; open decision 10). The project pauses after ~7 days without API traffic, and the site then shows "The collection is taking a break" (HTTP 540, `describeError()` → paused), or "The server didn't answer" when the paused answer comes without CORS headers. To bring it back: Supabase dashboard → the project → **Restore project** (takes a few minutes; nothing is lost). A Free project paused for more than 90 days can no longer be restored from the dashboard, which is one more reason for the backup routine below. If pausing becomes annoying, the options are a scheduled keep-alive ping (a Vercel cron or a GitHub Actions workflow) or the Pro plan.
- **Drafts** `plymouth-gtx-1971-altaya-black` and `mazda-rx-7-fd-1995-altaya-orange` (2026-10-02) are real models in progress (owner), not test leftovers. They stay.

## 5. Backups

`npm run backup:export` (`scripts/backup/`; restore notes in its README) writes every `diecast` table plus the Storage file lists to git-ignored `backups/<timestamp>/`, and with `-- --photos` the files too. **Routine:** run it after a batch of admin edits and at least monthly, with `--photos` when photos changed, and keep a copy off this machine. First full backup: `backups/2026-10-04T20-33-16/` (229 models, 454 files, 33 MB).

The Free plan includes no downloadable automatic backups, so this export is the backup. The schema itself is reproducible from `supabase/migrations/`.

## 6. Rollback plan

| What broke | Roll back by |
| --- | --- |
| A deploy (UI bug, blank page) | Vercel → Deployments → the last good production deployment → **Instant Rollback** (or "Promote to Production"). Then fix forward with `git revert` on `main`. No database step is needed: the UI changes of a deploy don't change the data |
| A wrong edit in the admin | Fix it in the admin, using the latest `backups/…/models.json` (and the child tables) as the reference |
| Photos (Storage) | `npm run images:flip -- --rollback` points `model_images` back at the original postimg URLs (`external_url`, kept on every migrated row; `scripts/migrate-images/README.md`). New photos uploaded in the admin have no postimg copy; restore those from a `--photos` backup |
| Data loss | Restore from `backups/` (`scripts/backup/README.md`). `src/data/car-models.json` + `npm run import:cars` can rebuild the 227 original cars, but **only** as a last resort: it predates every admin edit |
| A migration | Migrations are applied by hand in the SQL editor. Write and apply a reverse migration; take a backup before applying any new one |
| A leaked secret key | Rotate it in Supabase (Project Settings → API), update `.env.local`, and rerun `check-bundle-secrets.mjs --url` on production |

## 7. Sign-off

| | |
| --- | --- |
| Automated checks (section 2) | ✅ Claude, 2026-10-04 |
| Phase 36 + 37 preview deploy verified | ⬜ |
| Promoted to production and re-checked | ⬜ |
| Owner run: login / create / edit / upload / delete (section 3) | ⬜ owner |
| Throwaway records cleaned up | ✅ none found (2026-10-04); recheck after the owner run |
| **Go / no-go** | ⬜ owner |
