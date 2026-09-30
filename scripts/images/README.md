# Image pipeline (WebP → Supabase Storage)

A config-driven batch converter: a list of source image URLs → resized WebP variants → a Supabase Storage bucket, with **retries**, **resume**, **checksums** and a **dry run**. Nothing in this folder knows about diecast models; the diecast job lives in [`../migrate-images/`](../migrate-images/). It was built so the games and recipes apps can copy it (ROADMAP Phase 21, owner decision 2026-09-27).

Why generate WebP ourselves: Supabase's on-the-fly image transformations are a paid feature, and the free plan's egress (~5 GB/month) doesn't go far with ~180 KB PNG thumbnails. A ~400 px WebP thumbnail is ~25 KB.

## Files

| File | What it does |
| --- | --- |
| `types.ts` | `ImageJob`, `Variant`, `ImageSource`, `StorageTarget` |
| `cli.ts` | The command line: `upload` (dry run by default, `--apply` to upload) and `verify` |
| `batch.ts` | `runBatch()`: download each original once → every variant → upload → manifest. Concurrency pool, per-source failures don't stop the batch |
| `convert.ts` | `sharp`: fit inside `maxWidth × maxHeight`, never enlarge, EXIF-rotate, strip metadata, WebP; sha256 |
| `manifest.ts` | The JSON manifest: one entry per uploaded object (source URL + sha256, settings, output sha256/bytes/dimensions) |
| `retry.ts` | `withRetry()`: exponential backoff + jitter; retries network errors, timeouts, 408/425/429/5xx — not other 4xx |
| `verify.ts` | Compares what Storage serves with the manifest (`head`: status/type/size; `full`: sha256 + dimensions) |
| `supabase-target.ts` | Supabase Storage as the upload target; service-role client with a key-role check |
| `paths.ts` | Storage keys from a pattern, rejecting unsafe segments |

The browser counterpart for upload forms is [`src/lib/image-resize.ts`](../../src/lib/image-resize.ts) (canvas → WebP, same fit rules, no imports — copy it as-is).

## Using it in another repo

1. Copy `scripts/images/` (and `src/lib/image-resize.ts` if you have an upload form). Dev dependencies: `sharp`, `tsx`, `@supabase/supabase-js`.
2. Create a public bucket with admin-only writes — see [`supabase/migrations/20260930120000_diecast_storage.sql`](../../supabase/migrations/20260930120000_diecast_storage.sql) §1; swap the bucket name and the `is_admin()` check for yours.
3. Write a job module that default-exports an `ImageJob`:

   ```ts
   import type {ImageJob} from "../images/types.ts";

   const job: ImageJob = {
       name: "recipe photos",
       bucket: "recipe-images",
       pathPattern: "recipes/{slug}/{variant}.{ext}", // {variant} and {ext} are filled in; the rest come from vars
       variants: [
           {name: "full", maxWidth: 1600, quality: 82},
           {name: "thumb", maxWidth: 400, quality: 75},
       ],
       manifest: new URL("./manifest.json", import.meta.url), // commit it after the run: it's the record
       async sources(supabase) {
           const {data, error} = await supabase.from("recipes").select("slug, photo_url");
           if (error) throw error;
           return data.map((r) => ({key: r.slug, url: r.photo_url, vars: {slug: r.slug}}));
       },
   };
   export default job;
   ```

4. Put `VITE_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — never with a `VITE_` prefix for the key — and add npm scripts:

   ```json
   "images:migrate": "tsx --env-file-if-exists=.env.local scripts/images/cli.ts scripts/my-job.ts upload",
   "images:check": "tsx --env-file-if-exists=.env.local scripts/images/cli.ts scripts/my-job.ts verify"
   ```

5. Run:

   ```bash
   npm run images:migrate                     # dry run: downloads + converts everything, prints sizes, uploads nothing
   npm run images:migrate -- --limit=5 --apply
   npm run images:migrate -- --apply          # the rest; re-run after any failure — done sources are skipped
   npm run images:check -- --full             # every object: HTTP 200, sha256 and dimensions match the manifest
   ```

   Flags: `--dry-run` (the default), `--apply`, `--force` (redo even if done), `--only=key1,key2`, `--limit=N`.

Pointing your database rows at the new paths is app-specific — the diecast version (verify first, then flip every row in one transaction, with a rollback) is in [`../migrate-images/`](../migrate-images/).

## Behaviour worth knowing

- **Resume:** the manifest is rewritten after every source. A source is skipped when every variant is in the manifest with the same source URL and the same settings, *and* (on `--apply`) Storage still has each object at the recorded size. Change a variant's size/quality and the next run redoes everything.
- **Integrity:** each upload is followed by a `stat` that must report the uploaded byte count. `verify --full` downloads every object and checks sha256 + dimensions.
- **Failures:** a 404 or a non-image is final for that source (reported, not retried); everything else is retried up to `retries` times. The batch always finishes and exits 1 if anything failed.
- **Caching:** objects get `Cache-Control: max-age=604800` (a week) by default (`cacheControl`). If you overwrite an object at the same path, browsers may keep the old one for that long — prefer a new path for a new image.
- Extract into a shared package only if the copies in the three apps start diverging.
