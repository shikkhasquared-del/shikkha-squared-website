export const HLS={src:'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js',integrity:'sha384-V5ruNBgmYcC3SJRUQeNykAAAgde5gOFq/Hu0CZj7bygDP0yRIhkvX8+w0u/7mRvr'};
const analyticsScript='https://static.cloudflareinsights.com/beacon.min.js';

// All executable website scripts are external. Keep the two vendor URLs pinned to their paths.
export const pageSecurityHeaders={
  'content-security-policy':`script-src 'self' ${HLS.src} ${analyticsScript}; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
  'x-frame-options':'DENY',
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
};

// The site's public address, and whether search engines may list it. Listing stays off on the temporary
// workers.dev address so it doesn't compete with shikkhasquared.com; set SEARCH_INDEXING to "on" once
// shikkhasquared.com points at this site.
export const siteOrigin=()=>(process.env.PUBLIC_ORIGIN||'').replace(/\/$/,'');
export const indexingAllowed=()=>process.env.SEARCH_INDEXING==='on';

// Cloudflare Web Analytics: counts visits without cookies and without following anyone to other sites.
// The token is public (it appears in every page); set ANALYTICS_TOKEN in Vercel environment variables.
export const analyticsTag=()=>{const token=process.env.ANALYTICS_TOKEN||'';return /^[a-f0-9]{32}$/.test(token)?`<script defer src="${analyticsScript}" data-cf-beacon='{"token":"${token}"}'></script>`:'';};
