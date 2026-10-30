/* Only cache the public app shell and static assets. Private API data lives in
   account-scoped IndexedDB; never cache API responses or POST requests here. */
const CACHE = "iriva-shell-v3";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith("iriva-shell-") && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
// Registration happens after hydration. Explicitly cache resources that loaded
// before the worker gained control, including dynamically loaded chunk files.
self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_SHELL" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const results = await Promise.all(event.data.urls.map(async value => {
      const url = new URL(value, self.location.origin);
      if (url.origin !== self.location.origin || !(/^\/(learn|host|ops)\/?$/.test(url.pathname) || url.pathname.startsWith("/_next/static/"))) return;
      try {
        const response = await fetch(url.href);
        if (!response.ok) return false;
        const page = /^\/(learn|host|ops)\/?$/.test(url.pathname);
        if (page) {
          // A fresh HTML response can reference chunks that differ from the
          // currently hydrated document after a development rebuild.
          const html = await response.clone().text();
          const assets = [...new Set([...html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)].map(match => match[1].replaceAll("&amp;", "&")))];
          await Promise.all(assets.map(async asset => {
            const resource = await fetch(asset);
            if (!resource.ok) throw new Error("Shell asset unavailable");
            await cache.put(asset, resource);
          }));
        }
        await cache.put(page ? url.pathname : url.href, response);
        return true;
      } catch { return Boolean(await cache.match(/^\/(learn|host|ops)\/?$/.test(url.pathname) ? url.pathname : url.href)); }
    }));
    event.source?.postMessage({ type: "CACHE_SHELL_READY", ok: results.every(value => value !== false) });
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  const navigation = event.request.mode === "navigate" && /^\/(learn|host|ops)\/?$/.test(url.pathname);
  const asset = url.pathname.startsWith("/_next/static/");
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(navigation ? url.pathname : event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(navigation ? url.pathname : event.request)) || Response.error();
    }
  })());
});
