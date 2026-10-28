// Shikkha Squared service worker: lets students install the site as an app, and shows a friendly page when
// they open it without an internet connection. It caches nothing else: lessons, videos and account pages
// always come fresh from the site, so nothing private is stored on the device.
const CACHE='shikkha-offline-v2';
const OFFLINE_PAGE='/offline.html';
const FILES=['/assets/icon-192.png','/assets/favicon.svg'];

// The host may redirect /offline.html to /offline; store a plain copy so it can answer any page request.
async function prepare(){
  const cache=await caches.open(CACHE);
  const page=await fetch(OFFLINE_PAGE);
  if(!page.ok)throw new Error('Offline page unavailable');
  await cache.put(OFFLINE_PAGE,new Response(await page.blob(),{headers:{'content-type':'text/html; charset=utf-8'}}));
  await cache.addAll(FILES);
}
self.addEventListener('install',event=>{event.waitUntil(prepare().then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return; // form posts and payment returns go straight to the site
  if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE_PAGE)));return;}
  const url=new URL(request.url);
  if(url.origin===location.origin&&FILES.includes(url.pathname))event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});
