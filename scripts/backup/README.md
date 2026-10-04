# Backups

`npm run backup:export` writes a read-only snapshot of the live project to `backups/<timestamp>/` (git-ignored):

| File | Contents |
| --- | --- |
| `<table>.json` | Every row and column of each `diecast` table, drafts and private notes included, in parent → child order |
| `storage-model-images.json`, `storage-lookup-logos.json` | Every Storage object's path, size and date |
| `storage/<bucket>/…` | The files themselves, only with `npm run backup:export -- --photos` (~31 MB today) |
| `manifest.json` | Row/file counts and a sha256 per table file |

It needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, because RLS hides drafts, private notes and `admin_users` from anyone else. It only reads. A backup contains private notes and the admin's user id, so keep it on your machine (or your own private cloud drive) and never commit it.

**When to run it:** after a batch of edits in the admin, and at least monthly. Run it with `--photos` whenever photos were added or replaced. The Free plan has no downloadable automatic backups, so this export is the backup.

**What it doesn't cover:** Supabase Auth users (the owner account; recreate it in the dashboard and add its new id to `admin_users`) and project settings (exposed schema, sign-ups off, see `docs/SUPABASE-SETUP.md`).

## Restoring

There is deliberately no automatic restore script, because a wrong run against the live project would overwrite real data. To restore by hand:

1. **Schema:** on an empty project, run `supabase/migrations/*.sql` in filename order in the SQL editor (`docs/SUPABASE-SETUP.md`).
2. **Rows:** insert the table files in the order of `TABLES` in `export.mjs` (`categories` … `admin_users`). Two ways: paste each file's rows into an `insert … select * from json_populate_recordset(null::diecast.<table>, '<json>')` statement in the SQL editor, or POST each file to `/rest/v1/<table>` with the service-role key and `Prefer: resolution=merge-duplicates`. Keep the ids: the child tables refer to them.
3. **Photos:** upload `storage/model-images/` back to the `model-images` bucket under the same paths (and `lookup-logos` likewise). Paths must not change, since `model_images.storage_path` points at them.
4. Check: `npm run verify:types`, `npm run verify:stats`, `npm run images:verify`, `npm run verify:rls`.

For one wrong edit there is no need for any of this: fix the model in the admin, using the backup's JSON as the reference.
