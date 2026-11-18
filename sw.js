const CACHE='modolog-comunica-v1-8-4';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('modolog-comunica-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
// API e verificação de versão não devem receber resposta antiga do cache.
if(url.pathname.startsWith('/api')||url.pathname.startsWith('/functions/')||url.pathname==='/version.json')return;
event.respondWith((async()=>{try{const res=await fetch(req,{cache:'no-store'});if(res.ok&&url.pathname!=='/version.json'){const cache=await caches.open(CACHE);await cache.put(req,res.clone());}return res;}catch(err){const cached=await caches.match(req,{ignoreSearch:url.pathname==='/'||url.pathname==='/index.html'});if(cached)return cached;if(req.mode==='navigate'){const home=await caches.match('/');if(home)return home;}throw err;}})());});
