// Splashery's one service worker (lane Site r4), for the day the site is the front door. Generated
// from tools/site-sw-root.template.js by tools/site-build.mjs: don't edit sw.js by hand.
//
// It lives at the root (sw.js), so its scope is the whole project: the site, the Playground and
// the app. It replaces the preview site's worker (site/sw.js), which the swap turns into a stand-in
// that unregisters itself (tools/site-sw-retire.template.js).
//
// - Code never goes stale. index.html, every page, src/, vendor/ and every script, style, data and
//   manifest file come from the network first, so a visitor online always runs one version of the
//   code; the cache answers only when the network can't (offline) or takes more than a few
//   seconds. Old and new modules are never mixed.
// - assets/toys/ (the splat files, pictures and thumbnails) and the other media come from the
//   cache first and are refreshed in the background, so a toy played once keeps working offline.
// - The shell (every page, the site's styles and scripts, the search index, the 404 page) is cached
//   when this worker installs, in a cache named for the version. The version changes on every
//   deploy that changes the shell; the old shell is deleted when the new worker activates.
// - Pages that aren't there get 404.html (status 404), online or offline.

const VERSION = "@@VERSION@@";
const PRECACHE = ["@@PRECACHE@@"];
const SHELL = `splashery-shell-${VERSION}`;
const RUNTIME = "splashery-runtime";
const SCOPE = new URL("./", self.location).href;
const NOT_FOUND = new URL("404.html", SCOPE).href;
// Source, data and pages: always the network first.
const CODE = /\.(html|js|mjs|css|json|webmanifest|txt|xml|wasm|onnx)$/i;
const TOYS = new URL("assets/toys/", SCOPE).pathname;
const WAIT_MS = 5000; // a slow network gives way to the cache when there is one
// Caches the retired preview worker (site/sw.js) left behind.
const RETIRED = /^splashery-site-/;

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
            .filter((k) => (k.startsWith("splashery-shell-") && k !== SHELL) || RETIRED.test(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// A page asks the worker to keep files it already loaded before the worker was in charge (the
// first visit): { type: "splashery:keep", urls: [...] }.
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
      if (u.origin !== self.location.origin || (u.protocol !== "http:" && u.protocol !== "https:")) continue; // prettier-ignore
      if (!u.href.startsWith(SCOPE) || u.pathname.endsWith("/sw.js")) continue;
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
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return;
  if (url.pathname.endsWith("/sw.js")) return;
  if (req.mode === "navigate") {
    event.respondWith(page(req));
  } else if (url.pathname.startsWith(TOYS)) {
    event.respondWith(cacheFirst(req, event));
  } else if (
    CODE.test(url.pathname) ||
    /\/(src|vendor)\//.test(url.pathname) ||
    url.pathname.endsWith("/")
  ) {
    // prettier-ignore
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req, event));
  }
});

const PRECACHE_URLS = new Set(PRECACHE.map((p) => new URL(p, SCOPE).href));
async function store(req, res) {
  if (!res || !res.ok || res.status !== 200 || res.type === "opaque") return;
  const cache = await caches.open(PRECACHE_URLS.has(req.url) ? SHELL : RUNTIME);
  await cache.put(req, res);
}

const lookup = async (req) =>
  (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));

// The network, unless it takes longer than WAIT_MS and the cache has the file.
async function fromNetwork(req) {
  const hit = await lookup(req);
  const net = fetch(req).then((res) => {
    store(req, res.clone());
    return res;
  });
  if (!hit) return net;
  const slow = new Promise((resolve) => setTimeout(() => resolve(hit), WAIT_MS));
  net.catch(() => {}); // a late failure after the cache answered is not an error
  return Promise.race([net.catch(() => hit), slow]);
}

async function page(req) {
  try {
    const res = await fromNetwork(req);
    if (res.status === 404 && req.url.startsWith(SCOPE)) {
      const missing = await caches.match(NOT_FOUND);
      if (missing) return withStatus(missing, 404);
    }
    return res;
  } catch {
    const hit = await lookup(req);
    if (hit) return hit;
    const missing = await caches.match(NOT_FOUND);
    return missing ? withStatus(missing, 404) : Response.error();
  }
}

async function networkFirst(req) {
  try {
    return await fromNetwork(req);
  } catch {
    return (await lookup(req)) || Response.error();
  }
}

async function cacheFirst(req, event) {
  const hit = await caches.match(req);
  const refresh = fetch(req).then(
    (res) => {
      event.waitUntil(store(req, res.clone()));
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
