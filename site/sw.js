// Splashery's service worker for the preview site (lane Site). Generated from
// tools/site-sw.template.js by tools/site-build.mjs: don't edit site/sw.js by hand.
//
// It lives at site/sw.js, so its scope is site/ and nothing above it: the
// gallery and the app are never controlled by it during the preview.
//
// - The shell (every page, the site's own CSS and JS, the search index) is
//   cached when it installs, so the pages work offline after the first visit.
// - Pages, code and data come from the network first, so a visitor online
//   always gets the latest; the cache answers when the network can't.
// - Pictures, splat files and other media come from the cache first and are
//   refreshed in the background, so a toy played once keeps working offline.
// - A page under site/ that isn't there gets site/404.html.

const VERSION = "fc79fd8dcbec";
const PRECACHE = [
  "./",
  "toys/",
  "tools/",
  "science/",
  "studio/",
  "learn/",
  "new/",
  "about/",
  "search/",
  "404.html",
  "play/",
  "search-index.json",
  "manifest.webmanifest",
  "assets/offline.js",
  "assets/play.js",
  "assets/search.js",
  "assets/site.css",
  "assets/site.js",
  "../assets/app/icon-192.png",
  "../assets/app/icon-512.png",
];
const SHELL = `splashery-site-shell-${VERSION}`;
const RUNTIME = "splashery-site-runtime";
const SCOPE = new URL("./", self.location).href;
const NOT_FOUND = new URL("404.html", SCOPE).href;
const NETWORK_FIRST = /\.(html|js|mjs|css|json|webmanifest|txt|xml)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, SCOPE).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("splashery-site-shell-") && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// A page asks the worker to keep files it already loaded before the worker
// was in charge (the first visit): { type: "splashery:keep", urls: [...] }.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "splashery:keep" || !Array.isArray(data.urls)) return;
  event.waitUntil(keep(data.urls));
});

async function keep(urls) {
  const cache = await caches.open(RUNTIME);
  for (const url of urls.slice(0, 400)) {
    try {
      const u = new URL(url);
      if (u.origin !== self.location.origin || u.protocol !== "http:" && u.protocol !== "https:") continue; // prettier-ignore
      if (await caches.match(url)) continue;
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok && res.status === 200) await cache.put(url, res);
    } catch {
      // gone or offline: try again on the next visit
    }
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(page(req));
  } else if (NETWORK_FIRST.test(url.pathname) || url.pathname.endsWith("/")) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req, event));
  }
});

async function store(req, res) {
  if (!res || !res.ok || res.status !== 200 || res.type === "opaque") return;
  const cache = await caches.open(PRECACHE_URLS.has(req.url) ? SHELL : RUNTIME);
  await cache.put(req, res);
}
const PRECACHE_URLS = new Set(PRECACHE.map((p) => new URL(p, SCOPE).href));

async function page(req) {
  try {
    const res = await fetch(req);
    if (res.status === 404 && req.url.startsWith(SCOPE)) {
      const missing = await caches.match(NOT_FOUND);
      if (missing) return withStatus(missing, 404);
    }
    store(req, res.clone());
    return res;
  } catch {
    const hit = (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    const missing = await caches.match(NOT_FOUND);
    return missing ? withStatus(missing, 404) : Response.error();
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    store(req, res.clone());
    return res;
  } catch {
    const hit = (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));
    return hit || Response.error();
  }
}

async function cacheFirst(req, event) {
  const hit = await caches.match(req);
  const refresh = fetch(req).then(
    (res) => {
      const copy = res.clone();
      event.waitUntil(store(req, copy));
      return res;
    },
    () => null,
  );
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) || Response.error();
}

async function withStatus(res, status) {
  return new Response(await res.blob(), { status, headers: res.headers });
}
