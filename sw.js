/* Offline-cache för Körjournal. Höj CACHE när du släpper en ny version. */
var CACHE = 'korjournal-v40';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './pdf.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // adressuppslag och andra externa anrop går förbi cachen
  if (url.origin !== self.location.origin) return;

  /* Appens egna filer hämtas från nätet först, så en ny version slår
     igenom direkt. Cachen är reserv när telefonen är offline. */
  var arShell = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.slice(-1) === '/';

  if (arShell) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var kopia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, kopia); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* Ikoner och annat statiskt: cache först, uppdatera i bakgrunden. */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var hamta = fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var kopia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, kopia); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || hamta;
    })
  );
});
