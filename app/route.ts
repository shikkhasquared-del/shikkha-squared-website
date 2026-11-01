import { websiteHtml } from './legacy-html';
import { analyticsTag, indexingAllowed, siteOrigin } from '../lib/site';
export const dynamic='force-dynamic';

// Search-engine and link-preview tags for the homepage, matching the other pages (lib/catalog-pages.ts).
function homeTags(){
  const origin=siteOrigin(),listed=indexingAllowed();
  const organisation={'@context':'https://schema.org','@type':'EducationalOrganization',name:'Shikkha Squared',url:origin+'/',logo:origin+'/assets/icon-512.png',email:'shikkhasquared@gmail.com',telephone:'+8801787668201',address:{'@type':'PostalAddress',addressLocality:'Dhaka',addressCountry:'BD'}};
  return (listed?'':'<meta name="robots" content="noindex, nofollow">\n  ')
    +(origin?`<link rel="canonical" href="${origin}/">\n  <meta property="og:url" content="${origin}/">\n  <meta property="og:image" content="${origin}/assets/icon-512.png">\n  `:'')
    +'<meta property="og:site_name" content="Shikkha Squared">\n  <meta property="og:type" content="website">\n  <meta property="og:title" content="Shikkha Squared | Elevate Your Potential">\n  <meta property="og:description" content="O & A Level courses for Cambridge and Edexcel, with live learning, recorded courses and past-paper practice.">\n  <meta name="twitter:card" content="summary">\n  '
    +`<script type="application/ld+json">${JSON.stringify(organisation).replaceAll('<','\\u003c')}</script>\n`;
}
export async function GET(){return new Response(websiteHtml.replace('</head>',homeTags()+'</head>').replace('</body>','<script defer src="/chat.js?v=2"></script>'+analyticsTag()+'</body>'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});}
