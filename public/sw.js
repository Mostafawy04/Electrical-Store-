/* Service Worker — العمل دون إنترنت (Offline-first PWA)
   • تثبيت مسبق لـ App Shell و RSC payloads لجميع الصفحات الأساسية
   • كاش أولاً لملفات البناء (_next/static) + stale-while-revalidate لبقية الطلبات
   • كاش للخطوط (Google Fonts) ليبقى شكل التطبيق نفسه Offline
   • التنقلات: الشبكة أولاً ثم الكاش ثم صفحة بديلة — لا «لا يوجد اتصال» أبداً
   • آمن تماماً: أي فشل يُترك للمتصفح ولا يكسر التطبيق */
const VERSION = "v2";
const SHELL_CACHE = `sales-app-shell-${VERSION}`;
const RUNTIME_CACHE = `sales-app-runtime-${VERSION}`;
const FONT_CACHE = `sales-app-fonts-${VERSION}`;
const KEEP_CACHES = [SHELL_CACHE, RUNTIME_CACHE, FONT_CACHE];

const CORE = [
  "/",
  "/login",
  "/sales",
  "/purchases",
  "/inventory",
  "/reports",
  "/settings",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

const OFFLINE_HTML = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متصل</title>
<style>body{font-family:system-ui,Tahoma,sans-serif;background:#f1f5f9;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
.card{background:#fff;border:2px solid #0f172a;border-radius:16px;padding:28px;max-width:460px;box-shadow:0 16px 40px -18px rgba(15,23,42,.5)}
h1{margin:0 0 8px;font-size:22px}p{margin:6px 0;color:#475569;line-height:1.7}
a{display:inline-block;margin-top:14px;background:#0f766e;color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:700}</style></head>
<body><div class="card"><h1>📴 أنت غير متصل بالإنترنت</h1>
<p>لا مشكلة — التطبيق يعمل الآن من النسخة المحفوظة على جهازك، وكل فواتيرك وبياناتك محفوظة محلياً.</p>
<p>ستتم مزامنتها تلقائياً مع السحابة فور عودة الاتصال.</p>
<a href="/">فتح الصفحة الرئيسية</a></div></body></html>`;

function isFontHost(hostname) {
  return FONT_HOSTS.indexOf(hostname) !== -1;
}

/* ————— تثبيت: تجهيز الـ App Shell + معرفات الصفحات (RSC) ————— */
self.addEventListener("install", (event) => {
  try {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then(async (cache) => {
          await Promise.all(
            CORE.map((url) =>
              cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)
            )
          );
          // برمجيات الصفحات (RSC payloads) حتى تعمل التنقلات بالروابط Offline
          await Promise.all(
            CORE.filter((u) => u !== "/manifest.webmanifest" && u !== "/icons/icon.svg").map(
              (url) =>
                fetch(url, { headers: { RSC: "1", "Next-Router-Prefetch": "1" } })
                  .then((res) => (res && res.ok ? cache.put(url, res.clone()) : undefined))
                  .catch(() => undefined)
            )
          );
        })
        .catch(() => undefined)
        .then(() => self.skipWaiting())
    );
  } catch { /* ignore */ }
});

/* ————— تفعيل: تنظيف الكاش القديم ————— */
self.addEventListener("activate", (event) => {
  try {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => KEEP_CACHES.indexOf(k) === -1).map((k) => caches.delete(k))))
        .then(() => self.clients.claim())
    );
  } catch { /* ignore */ }
});

/* ————— رسائل: تحديث فوري عند توفر إصدار جديد ————— */
self.addEventListener("message", (event) => {
  try {
    if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") self.skipWaiting();
    if (event.data?.type === "CLEAR_CACHE") {
      event.waitUntil(Promise.all(KEEP_CACHES.map((c) => caches.delete(c))));
    }
  } catch { /* ignore */ }
});

/* ————— استراتيجيات الكاش ————— */
async function networkFirstNavigation(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req);
    try {
      if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => undefined);
    } catch { /* ignore */ }
    return fresh;
  } catch {
    try {
      const hit = (await cache.match(req)) || (await caches.match(req));
      if (hit) return hit;
    } catch { /* ignore */ }
    try {
      const shell = await caches.match("/");
      if (shell) return shell;
    } catch { /* ignore */ }
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Offline": "1" },
    });
  }
}

async function cacheFirstWithRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(req).catch(() => undefined);
  const network = fetch(req)
    .then((res) => {
      try {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => undefined);
      } catch { /* ignore */ }
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  return new Response("", { status: 504, statusText: "Offline" });
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(req).catch(() => undefined);
  const network = fetch(req)
    .then((res) => {
      try {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
      } catch { /* ignore */ }
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  return new Response(JSON.stringify({ error: "offline" }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Offline": "1" },
  });
}

async function cacheFirstFonts(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req, { ignoreVary: true }).catch(() => undefined);
  if (hit) {
    // تحديث بالخلفية
    fetch(req)
      .then((res) => {
        try {
          if (res) cache.put(req, res.clone()).catch(() => undefined);
        } catch { /* ignore */ }
      })
      .catch(() => undefined);
    return hit;
  }
  try {
    const res = await fetch(req);
    try {
      if (res) cache.put(req, res.clone()).catch(() => undefined);
    } catch { /* ignore */ }
    return res;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  try {
    if (req.method !== "GET") return;
    let url;
    try {
      url = new URL(req.url);
    } catch {
      return;
    }

    // خطوط جوجل: كاش أولاً ليبقى الشكل نفسه Offline
    if (isFontHost(url.hostname)) {
      event.respondWith(cacheFirstFonts(req));
      return;
    }

    // طلبات Supabase/الخارجية: تمرر مباشرة — تتولاها طبقة المزامنة (Outbox)
    if (url.origin !== self.location.origin) return;

    // التنقلات: الشبكة أولاً ثم الكاش ثم صفحة بديلة
    if (req.mode === "navigate") {
      event.respondWith(networkFirstNavigation(req));
      return;
    }

    // ملفات البناء والأيقونات: كاش أولاً (ثابتة وسريعة)
    if (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.webmanifest" ||
      /\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/.test(url.pathname)
    ) {
      event.respondWith(cacheFirstWithRevalidate(req));
      return;
    }

    // البقية (RSC payloads / صفحات / بيانات): كاش فوري + تحديث بالخلفية
    event.respondWith(staleWhileRevalidate(req));
  } catch { /* اترك المتصفح يتصرف */ }
});
