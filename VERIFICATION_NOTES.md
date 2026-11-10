# Verification and dependency review — 4 November 2026

Both projects were repaired and verified in their relocated home under D:\Website. Installed dependency links and local launch configurations now resolve to that location. Development and built local servers share ../.shikkha-dev-state; the built servers explicitly load the project's ignored .dev.vars file. No deployment or production database migration was performed.

## Dependency review

The registry audit fell from 23 advisories (2 critical, 7 high, 11 moderate, 3 low) to 2 moderate advisories in each project. Both production dependency audits (pnpm audit --prod) report zero findings. This is a registry dependency check, not a guarantee that the application is secure.

Patched versions: Next.js and eslint-config-next 16.4.1, Vite 8.1.6, Zod 4.6.6, Undici 7.30.1 and fast-uri 3.1.9. The TypeScript parser's compatible minimatch dependency is pinned to 11.0.1. The seven-day package release-age restriction and existing install-script allowlist remain enabled.

Two upstream constraints remain:

| Package | Advisory | Reason retained |
| --- | --- | --- |
| minimatch 3.1.5 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | ESLint and several lint plugins require its callable API. The patched 11.x API is incompatible with these callers. No blanket major override was applied. |
| Satori 0.16.0 through vinext / @vercel/og 0.8.6 | [GHSA-wx4j-mvgx-mqwp](https://github.com/advisories/GHSA-wx4j-mvgx-mqwp) | The renderer is bundled inside OG. A declared-dependency override would not repair that bundle. The tested replacement @vercel/og 1.0.3 failed its Node ESM import with a dynamic require of fs, so the working renderer was retained. |

The audit classifies both paths as development dependencies. The current apps expose no custom OG rendering route or user-supplied glob-pattern endpoint. Recheck these advisories when compatible upstream releases are available.

## Code and runtime verification

Both projects pass pnpm lint with zero errors and zero warnings, pnpm typecheck, pnpm build and their full test suites (56 tests each). Zod 4 was verified against the admin's schemas, reference catalogue, seed, defaults and API validation. Type safety now uses schema-derived CMS records and concrete public catalogue, database, auth, chat and payment types rather than explicit any.

Payment settlement is now one guarded D1 transaction: enrolment, discount usage, ledger, audit and paid status either commit together or roll back together. Repeated confirmations cannot duplicate a purchase. Distinct concurrent renewal payments each add a calendar month using the enrolment's value inside the transaction, including short months and leap years. Regression tests inject failures into each write and exercise concurrent confirmations and renewals. [D1 documents batch rollback semantics here](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Local built-server HTTP checks pass for health, published catalogue, homepage, courses, instructors, catalogue API and login. The protected admin API correctly refuses anonymous access (401), and the development fixture route is unavailable in production builds (404). SQLite quick_check returned ok for the existing shared local database.

## Launch requirements and limits

Live SMS sign-in still requires choosing and implementing a real SMS provider with its credentials; the current console provider is for development. SSLCommerz remains in sandbox mode and requires production merchant configuration and credentials before activation. No live checkout, SMS delivery, real-account sign-in or video load/capacity test was performed. This work changes local source and dependencies; it has not been deployed.

## Earlier functional verification

Malformed detail-page slugs now return HTTP 404, including invalid percent encoding and encoded separators, instead of being misreported as catalogue outages. Route and rendering tests cover these cases, separate page links, initial search/category filtering, unknown records, HTML/JSON escaping and paid-resource URL protection.

Public catalogue responses remain uncached to preserve the current immediate publishing behavior. Public page reads use the managed backend catalogue. The admin's catalogue toggle controls only the homepage's choice between its original catalogue and managed catalogue; dedicated catalogue pages always use published records. Record caps remain 500 in the public feed and 2,000 loaded in the admin; they are not visitor limits.

A bounded HTTP sample can verify only the tested requests and concurrency from its measurement location. It does not certify high-volume traffic, real-account browser login, mouse-wheel/keyboard behavior on devices, Core Web Vitals, live streaming or payment checkout. Those require separate testing or integration.
