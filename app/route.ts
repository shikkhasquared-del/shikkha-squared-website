import { websiteHtml } from './legacy-html';
export const dynamic='force-dynamic';
export async function GET(){return new Response(websiteHtml,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});}
