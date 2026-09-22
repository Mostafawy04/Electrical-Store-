/* Service Worker بسيط وآمن: App-Shell cache-first + عدم كسر التطبيق عند الفشل */
const CACHE = "sales-app-v1";
const CORE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  try {
    event.waitUntil(
      caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => undefined)).then(() => self.skipWaiting())
    );
  } catch { /* ignore */ }
});

self.addEventListener("activate", (event) => {
  try {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
    );
  } catch { /* ignore */ }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  try {
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return; // لا نخزن طلبات Supabase/الخطوط
    if (url.pathname.startsWith("/_next/")) {
      // ملفات البناء: stale-while-revalidate
      event.respondWith(
        caches.open(CACHE).then(async (cache) => {
          const hit = await cache.match(req).catch(() => undefined);
          const net = fetch(req).then((res) => {
            try { if (res && res.ok) cache.put(req, res.clone()); } catch {}
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      );
      return;
    }
    // التنقلات: network-first ثم الكاش ثم الصفحة الرئيسية
    if (req.mode === "navigate") {
      event.respondWith(
        fetch(req).then((res) => {
          try {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy).catch(() => undefined));
          } catch {}
          return res;
        }).catch(async () => (await caches.match(req).catch(() => undefined)) || (await caches.match("/").catch(() => undefined)))
      );
    }
  } catch { /* اترك المتصفح يتصرف */ }
});
