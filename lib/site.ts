import { env } from 'cloudflare:workers';

// The site's public address, and whether search engines may list it. Listing stays off on the temporary
// workers.dev address so it doesn't compete with shikkhasquared.com; set SEARCH_INDEXING to "on" once
// shikkhasquared.com points at this site.
export const siteOrigin=()=>(env.PUBLIC_ORIGIN||'').replace(/\/$/,'');
export const indexingAllowed=()=>env.SEARCH_INDEXING==='on';
