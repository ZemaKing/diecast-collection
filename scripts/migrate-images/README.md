# Model images → Supabase Storage (Phase 21 runbook)

Moves the 227 model photos off postimg.cc into the public `model-images` bucket as WebP, using the generic pipeline in [`../images/`](../images/README.md).

| | |
| --- | --- |
| Source | `model_images.external_url` (postimg full-size PNG; the roadmap calls it `legacy_url`) |
| Objects | `models/{slug}/{position}-full.webp` (fits 1600 px, q82) · `models/{slug}/{position}-thumb.webp` (fits 400 px, q75) — both from the full-size original |
| Record | [`manifest.json`](manifest.json) — per object: source URL + sha256, output sha256, bytes, dimensions. Commit it after the run |
| Flip | `storage_path` / `thumb_storage_path` (+ `width`/`height`) set in **one transaction** by `diecast.set_image_storage()` |
| Kept | `external_url` / `thumb_external_url` are never changed — they are the rollback path |

The app needs no change: `resolveImageUrl()` (`src/services/image-url.ts`) already prefers `storage_path` over `external_url`.

## Steps (owner, locally)

Needs `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

1. Apply `supabase/migrations/20260930120000_diecast_storage.sql` in the dashboard SQL editor (bucket, policies, flip function).
2. `npm run verify:rls` — now also proves the bucket: anon/user can't upload, overwrite, delete or list; the admin can; the public URL serves.
3. Upload:

   ```bash
   npm run images:migrate                    # dry run: download + convert all, print sizes (nothing uploaded)
   npm run images:migrate -- --apply         # upload; re-run the same command after any failure
   npm run images:check -- --full            # every object vs the manifest: 200, sha256, dimensions
   ```

4. Flip the rows (verifies every object again first; any failure blocks the whole flip):

   ```bash
   npm run images:flip                       # dry run: exact counts, rolled back
   npm run images:flip -- --apply
   ```

5. Verify what the app loads:

   ```bash
   npm run images:verify -- --legacy --sample=all
   ```

   Every row's full + thumb URL (resolved exactly like the app) answers HEAD 200; the sampled Storage objects match the manifest; every postimg URL still answers 200. Then open the site and check that images come from `…supabase.co/storage/v1/object/public/model-images/…`.

## Rollback

```bash
npm run images:flip -- --rollback           # dry run
npm run images:flip -- --rollback --apply   # storage_path + thumb_storage_path → null, in one transaction
```

The app falls straight back to `external_url` / `thumb_external_url` (postimg) — no deploy needed. The Storage objects are left in place, so flipping forward again is just `npm run images:flip -- --apply`. `npm run images:verify -- --legacy` confirms the postimg URLs still work (checked on 2026-09-30: all 454 answered 200).

## Re-running later

- New cars imported with postimg URLs: `npm run images:migrate -- --apply` uploads just the new ones (the rest are skipped), then `npm run images:flip -- --apply`.
- A car whose postimg URL changed is redone automatically (the manifest stores the source URL); the flip refuses to point a row at an image made from a different URL.
- From Phase 27, images uploaded in the admin form go straight to Storage (no `external_url`); this job ignores those rows.
