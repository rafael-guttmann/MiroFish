self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => new Response("Offline. Reconnect to reach the Holdings desk.", { status: 503, headers: { "Content-Type": "text/plain" } })));
});
