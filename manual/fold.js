// The manual's lighter layout in one small script (web version only):
//   1. <details class="fold"> sections (definitions, derivations, "Why this number?" notes, long
//      tables) start closed. A link to anything inside one opens it. Printing opens them all.
//   2. <span class="term" data-g="g-..."> words in the running text show their glossary entry in
//      a small pop-up: hover or focus on a computer, tap on a phone. Escape, a tap outside, or the
//      same word again closes it. The text comes from the glossary at the end of the page.
//   3. "Open all" and "Close all" for every fold.
// To change what folds, change the class on the element: no other code is involved.

const folds = () => [...document.querySelectorAll("details.fold")];

// ---- 1. Folds that open for a link, and for print ---------------------------------------------
function openFor(hash) {
  if (!hash || hash.length < 2) return;
  let el = null;
  try {
    el = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {}
  for (let d = el?.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
  if (el) el.scrollIntoView();
}
addEventListener("hashchange", () => openFor(location.hash));
openFor(location.hash);

let before = null;
addEventListener("beforeprint", () => {
  before = folds().map((d) => [d, d.open]);
  for (const d of folds()) d.open = true;
});
addEventListener("afterprint", () => {
  for (const [d, was] of before || []) d.open = was;
  before = null;
});

for (const b of document.querySelectorAll("[data-fold-all]")) {
  b.addEventListener("click", () => {
    const open = b.dataset.foldAll === "open";
    for (const d of folds()) d.open = open;
  });
}

// ---- 2. Glossary pop-ups ------------------------------------------------------------------------
const pop = document.createElement("div");
pop.id = "term-pop";
pop.setAttribute("role", "tooltip");
pop.hidden = true;
document.body.append(pop);
let current = null;
let pinned = false;

function glossaryEntry(id) {
  const dt = document.getElementById(id);
  const dd = dt?.nextElementSibling;
  if (!dt || dd?.tagName !== "DD") return null;
  return { title: dt.innerHTML, body: dd.innerHTML };
}

function show(term, pin) {
  const e = glossaryEntry(term.dataset.g);
  if (!e) return;
  current = term;
  pinned = pin;
  pop.innerHTML = `<strong>${e.title}</strong><span>${e.body}</span><a href="#${term.dataset.g}">In the glossary</a>`;
  pop.hidden = false;
  term.setAttribute("aria-describedby", "term-pop");
  const r = term.getBoundingClientRect();
  const w = Math.min(320, document.documentElement.clientWidth - 16);
  pop.style.width = `${w}px`;
  const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - w - 8));
  pop.style.left = `${left + scrollX}px`;
  // Below the word, or above it when there is no room below.
  const h = pop.offsetHeight;
  const below = r.bottom + 6 + h < innerHeight || r.top < h + 12;
  pop.style.top = `${(below ? r.bottom + 6 : r.top - h - 6) + scrollY}px`;
}

function hide() {
  current?.removeAttribute("aria-describedby");
  current = null;
  pinned = false;
  pop.hidden = true;
}

for (const term of document.querySelectorAll(".term[data-g]")) {
  term.tabIndex = 0;
  term.setAttribute("role", "button");
  term.addEventListener("mouseenter", () => {
    if (!pinned && matchMedia("(hover: hover)").matches) show(term, false);
  });
  term.addEventListener("mouseleave", () => {
    if (!pinned) hide();
  });
  term.addEventListener("focus", () => {
    if (!pinned) show(term, false);
  });
  term.addEventListener("blur", () => {
    if (!pinned) hide();
  });
  term.addEventListener("click", (e) => {
    e.preventDefault();
    if (current === term && pinned) hide();
    else show(term, true);
  });
  term.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (current === term && pinned) hide();
      else show(term, true);
    }
  });
}
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pop.hidden) {
    const t = current;
    hide();
    t?.focus({ preventScroll: true });
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!pop.hidden && !pop.contains(e.target) && !e.target.closest?.(".term")) hide();
});
addEventListener("scroll", () => !pop.hidden && !pinned && hide(), { passive: true });
