/* Service worker simples: guarda só a "casca" estática para abrir rápido.
   Páginas HTML: rede primeiro (sempre a versão nova). Supabase e outros domínios: nunca guardados. */
const CACHE = 'boxracoes-shell-v4';
const SHELL = ['/css/base.css','/css/mobile.css','/css/theme.css','/css/a11y.css','/img/logobox.png','/img/icon-192.png','/css/splash.css','/js/splash.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;
  if(url.pathname.startsWith('/admin/') || url.pathname === '/config.js') return;
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  if(SHELL.includes(url.pathname)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
