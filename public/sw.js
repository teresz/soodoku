// Service worker soodoku: szybki start przypiętej apki.
// Strona i pliki z tej domeny: od razu z pamięci, w tle dociąga świeżą wersję (nowy deploy widać przy następnym uruchomieniu).
// Czcionki Google: z pamięci, bo się nie zmieniają. Supabase, reklamy i reszta obcych adresów idą prosto do sieci.
const CACHE = 'soodoku-v2';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Linki z parametrami (?room=…, ?ads=demo) to ta sama strona: jeden wpis w pamięci na stronę.
  const key = req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key);
    const fresh = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') c.put(key, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  }));
});
