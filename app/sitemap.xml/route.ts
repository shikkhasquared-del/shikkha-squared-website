import { getCatalogue } from '../../lib/catalog-pages';
import { siteOrigin } from '../../lib/site';
export const dynamic='force-dynamic';

const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));

// Every public page, for search engines: home, the course and instructor directories and pages, and the legal pages.
export async function GET(){
  const origin=siteOrigin();
  const paths=['/','/courses','/instructors','/privacy','/terms'];
  try{
    const data=await getCatalogue();
    paths.push(...data.sections.map(s=>'/courses/category/'+encodeURIComponent(s.id)),...data.courses.map(c=>'/courses/'+encodeURIComponent(c.id)),...data.instructors.map(p=>'/instructors/'+encodeURIComponent(p.id)));
  }catch{}
  const body='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+paths.map(p=>`  <url><loc>${xml(origin+p)}</loc></url>`).join('\n')+'\n</urlset>\n';
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}});
}
