# Migration verification report — Phase 8

Generated 2026-09-29T18:03:01.518Z by `npm run verify:migration` (`scripts/verify-migration.ts`).
Compares `src/data/car-models.json` (via the importer's own transform) against `diecast.model_summaries`, read with the anon key.

## Aggregate counts

| Table | Expected (from JSON) | Actual (DB) | Match |
| --- | --- | --- | --- |
| models | 227 | 227 | ✅ |
| brands | 45 | 45 | ✅ |
| manufacturers | 19 | 19 | ✅ |
| categories | 5 | 5 | ✅ |
| colors | 13 | 13 | ✅ |
| drivers | 138 | 138 | ✅ |

## Per-model field comparison

Checked 227 models × (name, year, brand, manufacturer, category, color slugs/order, livery_hex/order, scale, driver, car number, image URLs, slug).

✅ 0 mismatches, 0 missing, 0 extra.

## Image URL field comparison (JSON `imageUrl`/`thumbnail` vs DB `external_url`/`thumb_external_url`)

✅ 0 mismatches — every stored URL matches the JSON exactly.

## Duplicate-slug and orphan checks

- Duplicate slugs in `models`: ✅ none
- Models with no image row: ✅ none
- Models with no brand (FK is NOT NULL — structurally impossible): ✅ none
- Models with no manufacturer (FK is NOT NULL — structurally impossible): ✅ none
- Models with no category (FK is NOT NULL — structurally impossible): ✅ none

## Image URL reachability (HEAD, 2 retries; transient failures never fail the build)

Checked 454 unique URLs (454 expected = 227 models × full + thumbnail, deduplicated).

⚠ 1 URL(s) failed after retries:

| URL | Status/Error |
| --- | --- |
| https://i.postimg.cc/wj4h9hx2/bmw-2-series-coupe-2014-herpa-red.png | The operation was aborted due to timeout |

## Conclusion

✅ **Pass.** Supabase matches `car-models.json` exactly: 0 mismatches, 0 orphans, 0 duplicates. 1 image URL(s) are currently unreachable (see above) — informational only.

**Owner action:** spot-check ~10 models in the Supabase dashboard against this report, then sign off in `ROADMAP.md` (Phase 8).
