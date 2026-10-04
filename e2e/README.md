# End-to-end tests (ROADMAP Phase 35)

```bash
npm run test:e2e                         # build + preview on :4174, then every journey
npx playwright test e2e/details.spec.ts  # one file
npx playwright test -g "Quick View"      # by test name
npm run test:e2e:report                  # open the HTML report of the last run
```

**Read-only by design.** The owner chose not to set up a separate test Supabase project, so the
suite runs the production build against the project in `.env.local`, which holds the live data,
and **never writes**. `fixtures.ts` aborts every non-GET/HEAD request from the page to Supabase and
fails the test that sent it, so a write test can't slip in by accident. Nothing here signs in.

- **Where the expected values come from:** `support/data.ts` reads the published models straight
  from PostgREST with the anon key. It does not use `src/services`, so a bug in the app's
  mapping or filtering can't also shift what the tests expect. Counts follow the live data, so
  adding a car never breaks the suite.
- **Browser:** the locally installed Microsoft Edge (`channel: "msedge"`), so there's no Playwright
  browser download. To use Chrome instead, set `E2E_CHANNEL=chrome`.
- **Projects:** `desktop` (1280×900) runs everything except `mobile.spec.ts`, and `mobile`
  (Pixel 7, touch) runs only that file.
- **Failures** keep a trace, a screenshot and an `error-context.md` (the page's accessibility
  tree) in `test-results/e2e/<test>/`. Open a trace with
  `npx playwright show-trace test-results/e2e/<test>/trace.zip`. There are no retries, so a flaky
  test shows up instead of being hidden.
- **Needs** the network and the Supabase project awake. A paused free-tier project fails every
  journey with the app's "paused project" error state.

| File | Covers |
| --- | --- |
| `collection.spec.ts` | load, brand filter + chip + Clear all, AND/OR filters, header search → `?q=`, empty state, sort, deep links, legacy `/cars` + `?model=`, view modes (persisted, not in URL), breadcrumb return with focus, browser Back, Quick View |
| `details.spec.ts` | details deep link, breadcrumb, spec links, tabs + `?tab=` + keyboard, lightbox open/Escape/focus, multi-photo paging (skipped until a model has >1 photo), unknown slug → 404 |
| `pages.spec.ts` | brands + manufacturers index → page → "Open in collection", slug redirect/404, statistics numbers, header nav + focus on `<h1>`, 404 page, skip link |
| `auth.spec.ts` | `/admin/*` signed out → `/login`, no admin UI when signed out, anon RLS reads: private notes, `admin_users`, drafts, `is_admin()` |
| `mobile.spec.ts` | no horizontal scroll, no hover Quick View, drawer, filter sheet, search → details |
| `a11y.spec.ts` | `@axe-core/playwright` on 7 key pages × dark/light, failing on critical/serious |

**Not covered here** (owner's decision): sign-in → create → edit → upload → delete, and RLS
*write* denials. Those need either a backend that can be written to or the owner's password.
They're covered by `npm run verify:rls` (real logins, throw-away `zz-rls-*` fixtures that it
deletes afterwards), `npm run verify:model-form` (every model through the form's code path and
a dry-run `save_model()`), and the unit/component tests.
