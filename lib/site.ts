import { env } from 'cloudflare:workers';

// The site's public address, and whether search engines may list it. Listing stays off on the temporary
// workers.dev address so it doesn't compete with shikkhasquared.com; set SEARCH_INDEXING to "on" once
// shikkhasquared.com points at this site.
export const siteOrigin=()=>(env.PUBLIC_ORIGIN||'').replace(/\/$/,'');
export const indexingAllowed=()=>env.SEARCH_INDEXING==='on';

// Cloudflare Web Analytics: counts visits without cookies and without following anyone to other sites.
// The token is public (it appears in every page); it's set in deploy/cloudflare.json as ANALYTICS_TOKEN.
export const analyticsTag=()=>{const token=env.ANALYTICS_TOKEN||'';return /^[a-f0-9]{32}$/.test(token)?`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`:'';};
