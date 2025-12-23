const CACHE_NAME = "hejiaxing-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js"
];

// 安裝時快取
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// 攔截請求（離線也能回應）
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(
      response => response || fetch(event.request)
    )
  );
});
