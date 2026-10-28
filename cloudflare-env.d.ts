declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CMS?: Fetcher;
    // Local dev only: the admin's dev server, e.g. http://localhost:5173. Cloudflare uses CMS.
    CMS_ORIGIN?: string;
    // Student accounts
    OTP_PEPPER?: string;
    SMS_PROVIDER?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    PUBLIC_ORIGIN?: string;
    // "on" lets search engines list the site; leave unset on the temporary workers.dev address.
    SEARCH_INDEXING?: string;
    // Cloudflare Web Analytics site token (public).
    ANALYTICS_TOKEN?: string;
    // Course payments (SSLCommerz). SSLCOMMERZ_LIVE="true" uses the live gateway; otherwise the sandbox.
    SSLCOMMERZ_STORE_ID?: string;
    SSLCOMMERZ_STORE_PASSWORD?: string;
    SSLCOMMERZ_LIVE?: string;
    // Protected lesson videos (Tenbyte CDN token authentication).
    TENBYTE_REFERRER?: string;
    TENBYTE_HOSTS?: string;
    BUCKET?: R2Bucket;
  }
}
