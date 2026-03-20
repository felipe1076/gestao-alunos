const CACHE_NAME = 'escola-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-First Strategy: Tenta buscar da rede primeiro, se falhar (offline), usa o cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a busca na rede deu certo, atualiza o cache e retorna a resposta
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Se falhar (offline), tenta encontrar no cache
        return caches.match(event.request);
      })
  );
});
