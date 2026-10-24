declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CMS?: Fetcher;
    CMS_ORIGIN?: string;
    CMS_READ_TOKEN?: string;
    // Student accounts
    OTP_PEPPER?: string;
    SMS_PROVIDER?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    PUBLIC_ORIGIN?: string;
    // Course payments (SSLCommerz). SSLCOMMERZ_LIVE="true" uses the live gateway; otherwise the sandbox.
    SSLCOMMERZ_STORE_ID?: string;
    SSLCOMMERZ_STORE_PASSWORD?: string;
    SSLCOMMERZ_LIVE?: string;
    // Protected lesson videos (Tenbyte CDN token authentication).
    TENBYTE_CDN_SECRET?: string;
    TENBYTE_HOSTS?: string;
  }
}
