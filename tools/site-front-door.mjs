// The swapped layout (lane Site r4): what the repo looks like on the day the site becomes the front
// door. tools/site-build.mjs builds every page once the way the preview has it (everything relative
// to site/, the Playground one folder up), and this file moves that into the final layout without
// touching the page generators:
//
//   /                       the site's home page (old "#s=" links and query options are sent on to
//                           the Playground before anything paints)
//   /playground/            the Playground (the app that was /index.html)
//   /toys/ /tools/ /science/ /studio/ /learn/ /new/ /about/ /search/ /share/ /play/
//                           the site's pages, where site/<same> was
//   /assets/…               the site's own styles and scripts join the app's assets/
//   /sw.js                  the one service worker (scope: the whole project)
//   /404.html               the root 404 page, in the live form
//   /sitemap.xml /search-index.json /manifest.webmanifest
//   /site/…                 a redirect for every old page, an unregistering stand-in for the old
//                           worker, and the few files other pages still point at
//
// It is pure: it takes the built files and returns the new layout. The build writes it into
// .cache/front-door/ (staged: symbolic links to the app's own files, so it can be served and tested)
// or, when FRONT_DOOR is on, into the repo itself.

import fs from "node:fs";
import path from "node:path";

// site/assets/ (the hand-written styles and scripts, the pictures) stays where it is: it is the
// source the build reads, the Manual's pages load site/assets/outline.{css,js}, and shared link
// previews may load og.png. The swapped layout gets copies in assets/. The catalog PDF is too big
// to keep twice: it stays in site/ and the pages that link it say so.
export const KEEP_IN_SITE = ["splashery-catalog.pdf"];

// A site-relative value ("../" is the Playground) at `depth` folders below site/ becomes the value
// for the swapped layout (same folder, the Playground at playground/).
export function lift(value, depth) {
  const outside = "../".repeat(depth + 1);
  const inside = "../".repeat(depth);
  if (value.startsWith(outside)) {
    let rest = value.slice(outside.length);
    if (rest === "" || rest[0] === "#" || rest[0] === "?") rest = `playground/${rest}`;
    return inside + rest;
  }
  for (const f of KEEP_IN_SITE) if (value === inside + f) return `${inside}site/${f}`;
  return value;
}

const ATTR = /\b(href|src|data-src|action|poster)="([^"]*)"/g;
const CSS_URL = /url\(&quot;([^&]*)&quot;\)/g;

export function liftHtml(html, depth) {
  return html
    .replace(ATTR, (m, a, v) => `${a}="${lift(v, depth)}"`)
    .replace(CSS_URL, (m, v) => `url(&quot;${lift(v, depth)}&quot;)`);
}

// Everything in the swapped layout points where it should: no link may still climb above the root.
export function assertNoEscapes(html, depth, where) {
  const outside = "../".repeat(depth + 1);
  for (const m of html.matchAll(ATTR)) {
    if (m[2].startsWith(outside)) throw new Error(`${where}: ${m[1]}="${m[2]}" still climbs above the root`); // prettier-ignore
  }
}

// ---- The home page: send old links to the Playground before anything paints ---------------------
// An old shared link is "/#s=…" (a scene) or "/?renderer=webgl2&…" (the app's options). The home
// page keeps "?labs", which both the site and the Playground read, and the usual tracking
// parameters.
export const FORWARD = `(function(){var l=location,h=l.hash,q=l.search,go=/(^#|&)s=/.test(h);if(!go&&q){go=q.slice(1).split("&").some(function(p){return p&&!/^(labs(=|$)|utm_|fbclid|gclid|ref=)/.test(p)})}if(go){document.documentElement.style.visibility="hidden";l.replace(l.pathname.replace(/index\\.html$/,"")+"playground/"+q+h)}})();`; // prettier-ignore

export function homePage(html, galleryHead) {
  const verification = /<meta name="google-site-verification"[^>]*>/.exec(galleryHead)?.[0] || "";
  const out = html.replace(
    /<meta charset="utf-8" \/>/,
    `<meta charset="utf-8" />\n<script>${FORWARD}</script>\n${verification}`,
  );
  if (out === html) throw new Error("The home page has no charset line to put the forwarding script after."); // prettier-ignore
  return out;
}

// ---- The Playground ----------------------------------------------------------------------------
// The app's index.html, one folder deeper, plus a line that registers the one service worker (so a
// visitor who only ever opens the Playground still gets the cache) and, after the page has loaded,
// hands the worker the files it loaded.
const REGISTER = `<script>
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        addEventListener("load", function () {
          navigator.serviceWorker
            .register("../sw.js", { scope: "../" })
            .then(function () {
              return navigator.serviceWorker.ready;
            })
            .then(function (reg) {
              setTimeout(function () {
                var urls = performance.getEntriesByType("resource").map(function (e) {
                  return e.name;
                });
                if (reg.active) reg.active.postMessage({ type: "splashery:keep", urls: urls });
              }, 8000);
            })
            .catch(function () {});
        });
      }
    </script>`;

export function playgroundPage(src) {
  if (src.includes('register("../sw.js"')) return src; // already moved (after the swap)
  // Every page-relative link and path moves one folder down: "./x" and "x" become "../x".
  let out = src
    .replace(/\b(href|src)="([^"]*)"/g, (m, a, v) =>
      /^(https?:|data:|#|\/|\.\.\/|mailto:)/.test(v) || !v
        ? m
        : `${a}="../${v.replace(/^\.\//, "")}"`,
    )
    .replace(/"\.\/(vendor|src|assets)\//g, '"../$1/')
    .replace("</head>", `    ${REGISTER}\n  </head>`);
  if (/"\.\/(vendor|src|assets)/.test(out)) throw new Error("The Playground still has a ./ path."); // prettier-ignore
  return out;
}

// ---- The search index and the sitemap ----------------------------------------------------------
export function liftIndex(json) {
  return JSON.stringify(
    JSON.parse(json).map((e) => ({ ...e, u: lift(e.u, 0), ...(e.i ? { i: lift(e.i, 0) } : {}) })),
  );
}

export function liftSitemap(xml, origin, siteBase) {
  const root = siteBase.replace(/site\/$/, "");
  return xml.replaceAll(`${origin}${siteBase}`, `${origin}${root}`);
}

// ---- Hand-written scripts that know where things are ------------------------------------------
function swap(text, from, to, where) {
  if (!text.includes(from)) throw new Error(`${where}: expected to find ${JSON.stringify(from)}`);
  return text.replaceAll(from, to);
}

export function liftScript(name, text) {
  if (name === "hubs.js") return swap(text, '"../src/element.js"', '"src/element.js"', name);
  if (name === "play.js") {
    let out = swap(text, '"../../src/toys.js"', '"../src/toys.js"', name);
    out = swap(out, "`../../#s=j.", "`../playground/#s=j.", name);
    return out;
  }
  return text;
}

// ---- Redirects left in site/ ------------------------------------------------------------------
// One page for every old address. The script keeps the query and the hash, so an old
// site/search/?q=duck or site/play/?toy=grape#… lands where it should; the meta refresh covers a
// browser with scripts off.
export function redirectPage(oldPath, newPath) {
  const depth = oldPath.split("/").filter(Boolean).length; // old page's folders below site/
  const target = "../".repeat(depth + 1) + newPath;
  const canonical = `${"__ORIGIN__"}${newPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>This page moved · Splashery</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${canonical}" />
<meta http-equiv="refresh" content="0; url=${target}" />
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head>
<body>
<p>This page moved to <a href="${target}">${newPath || "the home page"}</a>.</p>
</body>
</html>
`;
}

export function siteManifest(text) {
  // Installed copies of the preview keep working: they open the new home page.
  const m = JSON.parse(text);
  return JSON.stringify(
    {
      ...m,
      id: "./",
      start_url: "../",
      scope: "../",
      icons: m.icons.map((i) => ({ ...i, src: i.src.replace(/^\.\.\//, "../") })),
    },
    null,
    2,
  );
}

export function rootManifest(existing) {
  // The root manifest the app has had since UI r2, plus an id that keeps the installed app's
  // identity (its start URL, resolved) the same.
  const m = JSON.parse(existing);
  return JSON.stringify({ ...m, id: "./" }, null, 2);
}

// ---- The layout ---------------------------------------------------------------------------------
// `files` is the preview's output (paths under site/), `assets` its hand-written files
// (`assets/<name>` -> absolute path), `ctx` has what only the build knows.
export function swapLayout({ files, assets, ctx }) {
  const text = new Map(); // path from the root -> string
  const copy = new Map(); // path from the root -> absolute source (copied or linked as it is)
  const { origin, siteBase, notFoundLive, gallerySource, rootManifestText, swSource, retireSource, version, precache } = ctx; // prettier-ignore
  const homeBase = siteBase.replace(/site\/$/, "");

  for (const [rel, body] of files) {
    if (rel === "404.html" || rel === "sw.js" || rel === "manifest.webmanifest") continue;
    if (rel === "sitemap.xml") {
      text.set(rel, liftSitemap(body, origin, siteBase));
    } else if (rel === "search-index.json") {
      text.set(rel, liftIndex(body));
    } else if (rel.endsWith(".html")) {
      const depth = rel.split("/").length - 1;
      let html = liftHtml(body, depth).replaceAll(`${origin}${siteBase}`, `${origin}${homeBase}`);
      if (rel === "index.html") html = homePage(html, gallerySource);
      assertNoEscapes(html, depth, rel);
      text.set(rel, html);
    } else {
      throw new Error(`site/${rel}: the front-door layout doesn't know this file.`);
    }
  }
  text.set("404.html", notFoundLive);
  text.set("playground/index.html", playgroundPage(gallerySource));
  text.set("manifest.webmanifest", rootManifest(rootManifestText));
  text.set("sw.js", swSource.replace('"@@VERSION@@"', JSON.stringify(version)).replace('["@@PRECACHE@@"]', JSON.stringify(precache))); // prettier-ignore

  for (const [name, abs] of assets) {
    const base = path.basename(name);
    if (name.endsWith(".js") && ["hubs.js", "play.js"].includes(base)) {
      text.set(name, liftScript(base, fs.readFileSync(abs, "utf8")));
    } else copy.set(name, abs);
  }

  // The old addresses.
  for (const rel of files.keys()) {
    if (!rel.endsWith("index.html")) continue;
    const newPath = rel.replace(/index\.html$/, "");
    text.set(`site/${rel}`, redirectPage(newPath, newPath).replaceAll("__ORIGIN__", `${origin}${homeBase}`)); // prettier-ignore
  }
  text.set("site/404.html", redirectPage("", "").replaceAll("__ORIGIN__", `${origin}${homeBase}`));
  text.set("site/sw.js", retireSource);
  text.set("site/manifest.webmanifest", siteManifest(files.get("manifest.webmanifest")));
  return { text, copy };
}
