// =========================================================
// sw.js — Service Worker PWA
// ✅ CORRECTIFS :
//   - Chemins corrigés (étaient /styles.css et /app.js)
//   - Version du cache à incrémenter à chaque déploiement
// =========================================================

// ⚠️ Incrémenter ce numéro à chaque déploiement pour invalider
// l'ancien cache et forcer le téléchargement des nouveaux fichiers.
const CACHE_NAME = 'tontine-cache-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',       // ✅ chemin corrigé (était /styles.css)
  '/js/config.js',
  '/js/auth.js',
  '/js/data.js',
  '/js/ui.js',
  '/js/navigation.js',
  '/js/tontines.js',
  '/js/membres.js',
  '/js/tirages.js',
  '/js/app.js',            // ✅ chemin corrigé (était /app.js)
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
];

// ─── Installation : mise en cache des assets statiques ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Mise en cache des assets...');
      return cache.addAll(urlsToCache);
    }).then(() => {
      // Forcer l'activation immédiate sans attendre la fermeture des onglets
      return self.skipWaiting();
    })
  );
});

// ─── Activation : suppression des anciens caches ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Suppression ancien cache :', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // prendre le contrôle immédiatement
  );
});

// ─── Fetch : stratégie Network First pour l'API, Cache First pour les assets ───
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes API (toujours réseau)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return;
  }

  // Pour les assets statiques : Cache First avec fallback réseau
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Mettre en cache la nouvelle ressource
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Hors-ligne : fallback vers index.html pour les navigations
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
