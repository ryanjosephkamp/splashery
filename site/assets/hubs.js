// The embed guide's live example (lane Site pages): pick a toy and its options,
// see it run, and copy the iframe and element snippets. The live frame loads the
// site's own player (play/), which is the embed page inside the service worker's
// scope; the snippets point at the public embed address.

const lab = document.getElementById("embed-lab");
const form = document.getElementById("embed-form");
const frame = document.getElementById("embed-frame");
const toySelect = document.getElementById("eo-toy");
const root = new URL(document.documentElement.dataset.root || "./", location.href);
const ORIGIN = lab.dataset.origin; // https://ryanjosephkamp.github.io/splashery/

// The toy ids come from the search index (public toys; the id is in each link's scene).
async function loadToys() {
  const res = await fetch(new URL("search-index.json", root));
  const index = await res.json();
  const toys = [];
  for (const e of index) {
    if (e.k !== "toy" || e.l) continue;
    const payload = (e.u.split("#s=")[1] || "").replace(/^j\./, "");
    try {
      const scene = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      toys.push({ id: scene.toy.id, name: e.t, payload: e.u.split("#s=")[1] });
    } catch {
      // A link in some other form: leave it out.
    }
  }
  return toys.sort((a, b) => a.name.localeCompare(b.name));
}

function options() {
  const f = new FormData(form);
  const o = {};
  if (f.get("theme")) o.theme = f.get("theme");
  if (f.get("bg")) o.bg = f.get("bg");
  if (f.get("autoplay")) o.autoplay = f.get("autoplay");
  if (Number(f.get("zoom")) !== 1) o.zoom = String(Number(f.get("zoom")));
  if (f.get("turntable")) o.turntable = "off";
  if (f.get("controls")) o.controls = "0";
  return o;
}
const query = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"); // prettier-ignore

function update() {
  const o = options();
  const toy = toySelect.value;
  const width = new FormData(form).get("width");
  document.getElementById("eo-zoom-out").textContent = String(Number(new FormData(form).get("zoom")));
  const q = query({ toy, ...o });
  // The live example: the site's own copy of the embed page.
  const src = new URL(`play/?${q}`, root).href;
  frame.style.maxWidth = width || "none";
  const old = frame.querySelector("iframe");
  if (old) old.src = src;
  else {
    const f = document.createElement("iframe");
    f.title = "A live Splashery toy: drag to turn it";
    f.allow = "fullscreen";
    f.src = src;
    frame.append(f);
  }
  const style = `width:100%;${width ? `max-width:${width};` : ""}aspect-ratio:4/3;border:0;border-radius:12px${o.bg === "transparent" ? ";color-scheme:light" : ""}`;
  document.getElementById("snip-iframe").textContent = `<iframe\n  src="${ORIGIN}embed/?${q}"\n  title="Splashery toy"\n  loading="lazy"\n  style="${style}"\n></iframe>`; // prettier-ignore
  const attrs = [`toy="${toy}"`];
  if (o.theme) attrs.push(`theme="${o.theme}"`);
  if (o.bg) attrs.push(`background="${o.bg}"`);
  if (o.autoplay) attrs.push(`autoplay="${o.autoplay}"`);
  if (o.zoom) attrs.push(`zoom="${o.zoom}"`);
  if (o.turntable) attrs.push(`turntable="off"`);
  if (o.controls) attrs.push(`controls="0"`);
  document.getElementById("snip-element").textContent = `<script type="module" src="${ORIGIN}src/element.js"><\/script>\n<splashery-toy ${attrs.join(" ")}></splashery-toy>`; // prettier-ignore
  if (elementOn) showElement();
}

let elementOn = false;
async function showElement() {
  const stage = document.getElementById("element-stage");
  stage.hidden = false;
  if (!elementOn) await import(new URL("../src/element.js", root).href);
  elementOn = true;
  const el = document.createElement("splashery-toy");
  const o = options();
  el.setAttribute("toy", toySelect.value);
  if (o.theme) el.setAttribute("theme", o.theme);
  if (o.bg) el.setAttribute("background", o.bg);
  if (o.autoplay) el.setAttribute("autoplay", o.autoplay);
  if (o.zoom) el.setAttribute("zoom", o.zoom);
  if (o.turntable) el.setAttribute("turntable", "off");
  if (o.controls) el.setAttribute("controls", "0");
  stage.style.maxWidth = new FormData(form).get("width") || "none";
  stage.replaceChildren(el);
}

// A link to any toy, and the same toy as an embed address.
function updateLink(toys) {
  const sel = document.getElementById("lk-toy");
  const t = toys.find((x) => x.id === sel.value) || toys[0];
  document.getElementById("snip-link").textContent = `${ORIGIN}#s=${t.payload}`;
  document.getElementById("snip-embed-link").textContent = `${ORIGIN}embed/#s=${t.payload}`;
}

for (const btn of document.querySelectorAll("button.copy")) {
  btn.addEventListener("click", async () => {
    const text = document.getElementById(btn.dataset.copy).textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      // Clipboard blocked: select the text so a person can copy it by hand.
      getSelection().selectAllChildren(document.getElementById(btn.dataset.copy));
      btn.textContent = "Selected";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1800);
  });
}

document.getElementById("show-element").addEventListener("click", showElement);
form.addEventListener("input", update);
form.addEventListener("submit", (e) => e.preventDefault());

const toys = await loadToys();
const options_ = toys.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
const wanted = new URLSearchParams(location.search).get("toy");
toySelect.innerHTML = options_;
document.getElementById("lk-toy").innerHTML = options_;
toySelect.value = toys.some((t) => t.id === wanted) ? wanted : lab.dataset.home;
document.getElementById("lk-toy").value = toySelect.value;
document.getElementById("lk-toy").addEventListener("input", () => updateLink(toys));
toySelect.addEventListener("input", () => {
  document.getElementById("lk-toy").value = toySelect.value;
  updateLink(toys);
});
update();
updateLink(toys);
