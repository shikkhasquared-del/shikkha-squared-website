import { indexingAllowed, siteOrigin } from '../../lib/site';
export const dynamic='force-dynamic';

// Search engines may read the public pages once listing is switched on (SEARCH_INDEXING); student pages never.
export function GET(){
  const body=indexingAllowed()
    ?['User-agent: *','Disallow: /account','Disallow: /auth/','Disallow: /checkout','Disallow: /learn/','Disallow: /login','Disallow: /payment/','Disallow: /media/','Allow: /','',`Sitemap: ${siteOrigin()}/sitemap.xml`,''].join('\n')
    :'User-agent: *\nDisallow: /\n';
  return new Response(body,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
}
