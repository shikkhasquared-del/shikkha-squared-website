import { env } from 'cloudflare:workers';
// Local development: the admin's own dev server (e.g. http://localhost:5173), named in CMS_ORIGIN.
const localOrigin=/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;
export async function readCMS(path:string){
 if(path!=='/api/published'&&!/^\/api\/published\/media\/[a-f0-9-]{36}$/.test(path))throw new Error('Unsupported CMS read.');
 // On Cloudflare the admin is reached through a service binding: Worker to Worker, never over the
 // public internet, so Cloudflare Access can keep the admin's own address locked to staff.
 if(env.CMS)return env.CMS.fetch('https://cms.internal'+path,{redirect:'manual',signal:AbortSignal.timeout(10000)});
 const origin=env.CMS_ORIGIN;
 if(!origin||!localOrigin.test(origin))throw new Error('CMS is not configured.');
 return fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(10000)});
}
