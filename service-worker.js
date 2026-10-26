/* Service Worker ON!: cache-first para os arquivos do próprio jogo.
   >>> A CADA PUBLICAÇÃO com mudança de arquivo, aumente a versão em CACHE_NAME. <<< */
const CACHE_NAME = 'igoon-v2';

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./on.css",
  "./colorido.css",
  "./on.js",
  "./regras.js",
  "./sgf.js",
  "./goban.js",
  "./licoes.js",
  "./problemas.js",
  "./javinhas.js",
  "./estudo.js",
  "./ia.js",
  "./tsume.js",
  "./motor.js",
  "./manifest.json",
  "./assets/favicon.ico",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/qrpix.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Outros domínios (ex.: lista de jogos da hub) passam direto: quem pede cuida do offline.
  if (url.origin !== location.origin) return;
  // jogos.json (hub) é sempre buscado na rede primeiro: a lista precisa ficar atualizada
  if (url.pathname.endsWith('/jogos.json')) { event.respondWith(networkFirst(req)); return; }
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // arquivo que não estava na lista (ex.: ícone de um jogo novo na hub): guarda para o offline
    if (res.ok && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (e) {
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}
