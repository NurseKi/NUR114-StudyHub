// Offline helper for the NUR 114 Study Hub.
// Saves the hub and every module on the device so they open without internet.
// When online, it checks for a newer version first (3-second limit), then falls back to the saved copy.
const CACHE = "nur114-hub-v1";
const FILES = ["./", "index.html", "NUR114_Module1.html", "NUR114_Module2.html", "NUR114_Module3.html",
               "NUR114_Module4.html", "NUR114_Module5.html"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add each file separately so a module that doesn't exist yet doesn't stop the rest.
    await Promise.all(FILES.map(f => cache.add(new Request(f, {cache: "reload"})).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (!cached) return network.catch(() => cache.match("index.html"));
    // Prefer a fresh copy when it arrives quickly; otherwise use the saved copy.
    const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 3000));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});
