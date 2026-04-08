// ── AcuaGo Service Worker v1.0 ──────────────────────────────
// Cache-first para assets estáticos, network-first para Firebase

const CACHE_NAME   = 'acuago-v1';
const CACHE_STATIC = 'acuago-static-v1';

// Assets que se cachean en la instalación
const PRECACHE_URLS = [
  '/acuago/',
  '/acuago/index.html',
  '/acuago/manifest.json',
  '/acuago/icons/icon-192.png',
  '/acuago/icons/icon-512.png'
];

// Dominios que NUNCA se cachean (Firebase, APIs externas)
const BYPASS_DOMAINS = [
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'cloudfunctions.net'
];

// ── INSTALL: precachear assets críticos ─────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: limpiar caches viejos ─────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) {
            return key !== CACHE_STATIC && key !== CACHE_NAME;
          })
          .map(function(key) {
            return caches.delete(key);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: estrategia por tipo de request ───────────────────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // 1. Bypass total para Firebase y dominios externos
  var isBypass = BYPASS_DOMAINS.some(function(d) {
    return url.hostname.includes(d);
  });
  if (isBypass) return;

  // 2. Solo cachear GET
  if (event.request.method !== 'GET') return;

  // 3. Cache-first para assets estáticos (.js, .css, .png, .ico, fuentes)
  var isStatic = /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (!response || response.status !== 200) return response;
          var clone = response.clone();
          caches.open(CACHE_STATIC).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // 4. Network-first para navegación (HTML)
  var isNavigation = event.request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Offline: servir index.html cacheado
        return caches.match('/acuago/index.html');
      })
    );
    return;
  }

  // 5. Network-first para todo lo demás con fallback a cache
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

// ── PUSH NOTIFICATIONS (preparado para OneSignal / futuro) ──
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  var options = {
    body:    data.body    || '',
    icon:    data.icon    || '/acuago/icons/icon-192.png',
    badge:   data.badge   || '/acuago/icons/icon-96.png',
    tag:     data.tag     || 'acuago',
    data:    data.data    || {},
    vibrate: [200, 100, 200],
    actions: data.actions || []
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'AcuaGo', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/acuago/')
  );
});
