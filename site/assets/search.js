// Search on the device (lane Site): site/search-index.json, built by
// tools/site-build.mjs, holds every toy, tool and page. Every word typed must
// appear in an entry's words; names that start with a word come first, as in
// the gallery's own search. Labs toys show only with the labs switch on.

const input = document.getElementById("q");
const list = document.getElementById("search-results");
const status = document.getElementById("search-status");
const suggest = document.getElementById("search-suggest");
const up = "../";
const labs = document.documentElement.classList.contains("labs");

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

let entries = null;
async function load() {
  entries ??= fetch(`${up}search-index.json`)
    .then((r) => r.json())
    .then((all) => all.filter((e) => labs || !e.l).map((e) => ({ ...e, w: `${e.w} ${fold(e.d)}` })));
  return entries;
}

export function search(all, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const kindRank = { page: 1, tool: 1, toy: 0 };
  const scored = [];
  for (const e of all) {
    if (!words.every((w) => e.w.includes(w))) continue;
    const name = fold(e.t);
    const score = words.reduce(
      (n, w) => n + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 0),
      kindRank[e.k] || 0,
    );
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.e);
}

const KIND = { toy: "Toy", tool: "Tool", page: "Page" };
function item(e) {
  const li = document.createElement("li");
  li.className = `result result-${e.k}`;
  const a = document.createElement("a");
  a.href = /^https?:/.test(e.u) ? e.u : up + e.u;
  if (e.i) {
    const img = document.createElement("img");
    img.src = up + e.i;
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
  const line = document.createElement("span");
  line.className = "result-line";
  line.textContent = e.d || "";
  text.append(name, meta, line);
  a.append(text);
  li.append(a);
  return li;
}

async function run(query, { push = false } = {}) {
  const q = query.trim();
  const url = new URL(location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  history[push ? "pushState" : "replaceState"](null, "", url);
  if (suggest) suggest.hidden = !!q;
  if (!q) {
    list.replaceChildren();
    status.textContent = "";
    return;
  }
  const found = search(await load(), q);
  if (input.value.trim() !== q) return; // typed on meanwhile
  list.replaceChildren(...found.slice(0, 60).map(item));
  status.textContent = found.length
    ? `${found.length} result${found.length === 1 ? "" : "s"} for “${q}”${found.length > 60 ? ", the first 60 shown" : ""}` // prettier-ignore
    : `Nothing found for “${q}”. Try another word, like a shelf (Space, Food) or what a toy does (peel, play).`; // prettier-ignore
}

if (input) {
  const start = new URLSearchParams(location.search).get("q") || "";
  input.value = start;
  const header = document.getElementById("site-search");
  if (header) header.value = start;
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value), 120);
  });
  input.form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(input.value, { push: true });
  });
  if (start) run(start);
  else input.focus();
}
