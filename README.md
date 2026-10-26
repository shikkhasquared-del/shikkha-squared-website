# Shikkha Squared — public website

The redesigned public website for Shikkha Squared. It includes:

- the homepage, course and instructor pages;
- student accounts, with sign-in by mobile number or Google;
- online course purchases through SSLCommerz;
- the classroom, where enrolled students watch protected lesson videos;
- the privacy and terms pages.

It runs as a Cloudflare Worker (built with [vinext](https://github.com/cloudflare/vinext)). The catalogue (courses, sections, instructors, content, banners) is managed in the admin dashboard (`D:\Shikkha_Squared_Backend_Source`), and both share one D1 database.

## Main files

| Purpose | Files |
| --- | --- |
| Homepage | `app/route.ts`, `app/legacy-html.ts`, `public/app.js`, `public/motion.js`, `public/styles.css`, `public/motion.css` |
| Course and instructor pages | `lib/catalog-pages.ts`, `app/courses/`, `app/instructors/`, `public/catalog-pages.js`, `public/catalog-pages.css` |
| Reading the catalogue from the admin | `lib/cms-read.ts`, `app/api/catalog/route.ts`, `app/media/[id]/route.ts` |
| Student accounts and sign-in | `lib/student-auth.ts`, `lib/google-auth.ts`, `lib/sms.ts`, `lib/student-server.ts`, `lib/student-pages.ts`, `app/login/`, `app/auth/`, `app/account/` |
| Payments | `lib/payments.ts`, `lib/payment-callbacks.ts`, `app/checkout/`, `app/payment/` |
| Classroom and video streaming | `lib/classroom.ts`, `lib/lessons.ts`, `lib/classroom-pages.ts`, `app/learn/`, `public/player.js` |
| Privacy and terms pages | `lib/legal-pages.ts`, `app/privacy/`, `app/terms/` |
| Database tables for students, orders and enrolments | `db/schema.ts`, `drizzle/` |
| Tests | `tests/` |

`design-handoff/` holds the original rebranding files. They are kept for reference and are not published.

## Local development

Use Node.js 22.13 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm dev --port 5174
```

Open http://localhost:5174. Run the admin at the same time (`pnpm dev` in its folder, port 5173): the website reads its catalogue from there through `CMS_ORIGIN`.

With `SMS_PROVIDER="console"`, phone sign-in codes are printed in the terminal instead of being sent.

Both sites keep their local database in `D:\.shikkha-dev-state`. To create this site's tables in a new local database, build once and apply the migrations in order:

```sh
pnpm build
node --import ./scripts/wrangler-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to ../.shikkha-dev-state --file drizzle/0000_student_accounts.sql
node --import ./scripts/wrangler-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to ../.shikkha-dev-state --file drizzle/0001_orders_enrolments.sql
```

The catalogue tables come from the admin project's migration.

## Checks

```sh
node --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

## Deploying

```sh
pnpm run deploy
```

This builds with the real settings in `deploy/cloudflare.json` and deploys with Wrangler. Wrangler must be logged in to the Cloudflare account. On Cloudflare the website reads the catalogue through the `CMS` service binding (Worker to Worker), so the admin can stay behind Cloudflare Access.

Plain settings live in `deploy/cloudflare.json`. Secrets are set with `wrangler secret put` and never go in the repository.

| Setting | Kind | Purpose |
| --- | --- | --- |
| `DB` | binding | D1 database, shared with the admin |
| `CMS` | binding | The admin Worker, for the published catalogue and public media |
| `PUBLIC_ORIGIN` | setting | The site's public address, used in Google and payment return links |
| `GOOGLE_CLIENT_ID` | setting | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | secret | Google sign-in |
| `OTP_PEPPER` | secret | Hashes phone sign-in codes |
| `SMS_PROVIDER` | setting | No production SMS provider exists yet, so phone sign-in is unavailable on the live site |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_LIVE` | settings | Payment gateway store, and sandbox or live mode |
| `SSLCOMMERZ_STORE_PASSWORD` | secret | Payment gateway |
| `TENBYTE_REFERRER` | secret | Private referrer host that Tenbyte's access rule allows; the site sends it when fetching lesson videos |
| `TENBYTE_HOSTS` | setting | Optional: video hosts other than `*.tenbytecdn.com` |

## More documentation

- `VERIFICATION_NOTES.md` — verification and dependency review from 12 October 2026
- `design-handoff/handoff.md` — the original design handoff
