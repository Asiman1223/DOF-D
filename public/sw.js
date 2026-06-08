// public/sw.js — Service Worker für DOF Cloud PWA

const CACHE = "dofclothes-v1";
const ASSETS = ["/", "/index.html"];

// ── Installation ──────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Aktivierung ───────────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (Network first, Cache fallback) ─────────────────────────────
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  // API Calls nicht cachen
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push Notification empfangen ───────────────────────────────────────
self.addEventListener("push", e => {
  let data = { title: "DOF Cloud", body: "Neue Benachrichtigung", url: "/" };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    "/icons/icon-192.png",
      badge:   "/icons/icon-192.png",
      tag:     "dof-notification",
      renotify: true,
      data:    { url: data.url },
      actions: [{ action:"open", title:"Öffnen" }],
    })
  );
});

// ── Auf Notification klicken ──────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
