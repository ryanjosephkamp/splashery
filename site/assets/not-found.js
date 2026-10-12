// The root 404 page's helper (lane Site r4). GitHub Pages serves 404.html for any missing path under
// the project, at any depth. This reads the path's words and finds what the visitor may have meant:
//
// - a path that names a toy (an old toy address) goes straight to that toy;
// - otherwise it lists the toys (and, once the site is the front door, the tools and pages) whose
//   words match, searched on the device in the same index the site's search uses.
//
// Links written for old shared scenes ("#s=…") are sent on by the small script in the page's head,
// before anything paints. <html data-mode="preview|live" data-gallery="" data-index="…"> says where
// things are: before the swap the Playground is the root and the index lives in site/; after it the
// Playground is playground/ and the index is at the root.

const root = document.documentElement;
const { mode, gallery, index: indexPath } = root.dataset;
const live = mode === "live";
const base = new URL(document.baseURI);
const form = document.getElementById("nf-form");
const input = document.getElementById("q404");
const results = document.getElementById("nf-results");
const status = document.getElementById("nf-status");
const labs = (() => {
  try {
    return localStorage.getItem("splashery.labs") === "1";
  } catch {
    return false;
  }
})();

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// The words of the path that was asked for, without the plumbing.
const SKIP = new Set(["site", "html", "htm", "index", "splashery", "www", "page", "pages", "the", "and"]); // prettier-ignore
export function pathWords(pathname, prefix = "/") {
  let p = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw path
  }
  return fold(p)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !SKIP.has(w) && !/^\d+$/.test(w));
}

// Every word must match; names that start with a word first (as the site's own search does).
export function find(entries, words) {
  const scored = [];
  for (const e of entries) {
    if (!words.every((w) => e.w.includes(w))) continue;
    const name = fold(e.t);
    const score = words.reduce(
      (n, w) => n + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 0),
      e.k === "toy" ? 0 : 1,
    );
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.t.localeCompare(b.e.t));
  return scored.map((s) => s.e);
}

// A scene link that opens a toy in the Playground (a version 3 scene, plain JSON form).
export function sceneHash(id) {
  const scene = { app: "splashery", version: 3, toy: { kind: "builtin", id } };
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(scene))));
  return "j." + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const toyId = (e) => (e.k === "toy" ? e.u.replace(/\/$/, "").split("/").pop() : "");

// Where a result goes: before the swap the toys open in the Playground (the only public place a
// toy lives); after it the toy's own page, the tools and pages where they are.
function href(e) {
  if (!live) return new URL(`${gallery}#s=${sceneHash(toyId(e))}`, base).href;
  return new URL(e.u, base).href;
}

let entries = null;
async function load() {
  entries ??= fetch(new URL(indexPath, base))
    .then((r) => r.json())
    .then((all) =>
      all
        .filter((e) => (labs || !e.l) && (live || e.k === "toy"))
        .map((e) => ({ ...e, w: `${e.w} ${fold(e.d)}` })),
    );
  return entries;
}

const KIND = { toy: "Toy", tool: "Tool", page: "Page" };
function show(list, words) {
  results.textContent = "";
  for (const e of list.slice(0, 8)) {
    const li = document.createElement("li");
    li.className = `result result-${e.k}`;
    const a = document.createElement("a");
    a.href = href(e);
    if (e.i) {
      const img = document.createElement("img");
      img.src = new URL(live ? e.i : e.i.replace(/^\.\.\//, ""), base).href;
      img.alt = "";
      img.width = img.height = 56;
      img.loading = "lazy";
      a.append(img);
    } else {
      const s = document.createElement("span");
      s.className = "no-thumb";
      s.setAttribute("aria-hidden", "true");
      a.append(s);
    }
    const text = document.createElement("span");
    text.className = "result-text";
    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = e.t;
    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = e.s ? `${KIND[e.k]} · ${e.s}` : KIND[e.k];
    text.append(name, meta);
    a.append(text);
    li.append(a);
    results.append(li);
  }
  status.textContent = list.length
    ? `${list.length > 8 ? "Top 8 of " : ""}${list.length} match${list.length === 1 ? "" : "es"} for “${words.join(" ")}”.`
    : words.length
      ? `Nothing matches “${words.join(" ")}”. Try fewer words.`
      : "";
}

async function run(words, { redirect = false } = {}) {
  if (!words.length) return show([], words);
  let all;
  try {
    all = await load();
  } catch {
    status.textContent = "Search isn't available right now.";
    return;
  }
  if (redirect) {
    // An old toy address: a path segment that is a toy's id.
    const ids = new Map(all.filter((e) => e.k === "toy").map((e) => [toyId(e), e]));
    const seg = decodeURIComponent(location.pathname)
      .replace(/\.html?$/i, "")
      .split("/")
      .filter(Boolean)
      .reverse()
      .find((s) => ids.has(s));
    if (seg) return location.replace(href(ids.get(seg)));
  }
  let found = find(all, words);
  // Nothing for all the words: try the longest one on its own.
  if (!found.length && words.length > 1) {
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    found = find(all, [longest]);
    words = [longest];
  }
  show(found, words);
}

if (form) {
  const words = pathWords(location.pathname, base.pathname);
  input.value = words.join(" ");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    run(fold(input.value).split(/\s+/).filter(Boolean));
  });
  run(words, { redirect: true });
}
