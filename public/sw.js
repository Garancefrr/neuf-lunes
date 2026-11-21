// Neuf Lunes : garde une copie de la page pour qu'elle s'ouvre même avec un réseau faible.
// Les analyses passent toujours par le réseau.
const CACHE = "neuf-lunes-v1";
const FICHIERS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || req.url.includes("/api/")) return;
  // Réseau d'abord (pour avoir toujours la dernière version), copie locale si pas de réseau
  e.respondWith(fetch(req).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); return r; }).catch(() => caches.match(req).then((r) => r || caches.match("/"))));
});
