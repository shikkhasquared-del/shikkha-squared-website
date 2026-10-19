# Verification — 12 October 2026

Both the frontend and admin were reviewed against their current published source. Compatible security patches were applied to their shared dependency tree: Next.js 16.3.8, React / React DOM / React Server DOM 19.2.8, Vite 8.0.16, Sharp 0.35.5, image-size 2.0.3 and patched transitive packages. The post-update registry audit has one remaining high advisory for build/lint glob matching in `braces` 3.0.3; no patched release is listed. Application code exposes no user-supplied glob-pattern endpoint. This is not a guarantee of zero risk.

Malformed detail-page slugs now return HTTP 404, including invalid percent encoding and encoded separators, instead of being misreported as catalogue outages. Route and rendering tests cover these cases, separate page links, initial search/category filtering, unknown records, HTML/JSON escaping and paid-resource URL protection.

Public catalogue responses remain uncached to preserve the current immediate publishing behavior. Public page reads use the managed backend catalogue. The admin's catalogue toggle controls only the homepage's choice between its original catalogue and managed catalogue; dedicated catalogue pages always use published records. Record caps remain 500 in the public feed and 2,000 loaded in the admin; they are not visitor limits.

The supported browser-control capability was unavailable. A bounded HTTP sample can verify only the tested requests and concurrency from its measurement location. It does not certify high-volume traffic, real-account browser login, mouse-wheel/keyboard behavior on devices, Core Web Vitals, live streaming or payment checkout. Those require separate testing or integration.
