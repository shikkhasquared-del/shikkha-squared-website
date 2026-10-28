// "Install the app": registers the service worker on every page, and on the account page offers to add
// Shikkha Squared to the home screen (a button where the browser supports it, instructions on iPhone and iPad).
(()=>{
  'use strict';
  if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
  const box=document.getElementById('install-app');
  if(!box)return;
  const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(installed)return;
  const button=box.querySelector('.install-button'),help=box.querySelector('.install-ios');
  const apple=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(apple){box.hidden=false;help.hidden=false;return;}
  let offer=null;
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();offer=event;box.hidden=false;button.hidden=false;});
  button.addEventListener('click',async()=>{if(!offer)return;offer.prompt();await offer.userChoice.catch(()=>null);offer=null;box.hidden=true;});
  addEventListener('appinstalled',()=>{box.hidden=true;});
})();
