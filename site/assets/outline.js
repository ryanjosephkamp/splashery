// The quick outline for long pages (lane Site r2). One shared script: a page opts in by putting
// data-outline on its <main> (the build does it for pages with `outline: true`; the Tinkerer's
// Manual does it by hand). It reads the page's h2 headings and adds a thin bar after the intro
// that names the section you are in and opens a list of every section. It never scrolls the page
// itself: picking a section is an ordinary in-page link, so the browser jumps (with scroll-padding
// keeping the heading clear of the header and the bar) and Back returns you. Keyboard: the bar is
// a button; Escape closes the list and returns focus to it. Pages with fewer than four sections,
// and browsers without script, get no bar and lose nothing.

const root = document.querySelector("[data-outline]");
const headings = root
  ? [...root.querySelectorAll("h2[id]")].filter((h) => !h.closest("nav, .no-outline"))
  : [];

if (root && headings.length >= 4) {
  const bar = document.createElement("div");
  bar.className = "outline no-print";
  bar.innerHTML = `<button type="button" class="outline-toggle" aria-expanded="false" aria-controls="outline-panel"><span class="outline-label">Contents</span><span class="outline-now"></span><svg class="outline-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><nav class="outline-panel" id="outline-panel" aria-label="Jump to a section" hidden><ol></ol></nav>`; // prettier-ignore
  const toggle = bar.querySelector("button");
  const now = bar.querySelector(".outline-now");
  const panel = bar.querySelector("nav");
  const list = bar.querySelector("ol");
  const text = (h) => [...h.childNodes].map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim(); // prettier-ignore
  for (const h of headings) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = text(h);
    li.append(a);
    list.append(li);
  }
  const links = [...list.querySelectorAll("a")];

  // After the page's own contents list if it has one, else after its intro, so the bar never
  // pushes the top of the page down and never repeats the list right beside it.
  const first = root.querySelector(":scope > .toc, :scope > .cover, :scope > .page-intro") || root.firstElementChild; // prettier-ignore
  if (first && first.parentElement === root) first.after(bar);
  else root.prepend(bar);
  document.documentElement.classList.add("has-outline");

  // The bar sticks under the site header, if the page has one.
  const header = document.querySelector(".site-header");
  const measure = () => {
    const top = header ? header.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--outline-top", `${Math.round(top)}px`);
    document.documentElement.style.setProperty("--outline-h", `${Math.round(toggle.offsetHeight)}px`); // prettier-ignore
  };
  measure();
  addEventListener("resize", measure);

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  bar.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  // A tap outside, or Tab out of the list, closes it.
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !bar.contains(e.target)) setOpen(false);
  });
  bar.addEventListener("focusout", (e) => {
    if (!panel.hidden && e.relatedTarget && !bar.contains(e.relatedTarget)) setOpen(false);
  });
  // Picking a section: the link jumps by itself; close the list and move focus to the heading
  // so a screen reader reads where you landed.
  list.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const target = document.getElementById(a.hash.slice(1));
    setOpen(false);
    if (target) {
      target.tabIndex = -1;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  });

  // Which section is on screen: the last heading that has reached the top of the page.
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = (header ? header.getBoundingClientRect().height : 0) + toggle.offsetHeight + 24;
    let current = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h;
      else break;
    }
    now.textContent = current ? text(current) : "Top of the page";
    links.forEach((a, i) =>
      headings[i] === current ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current"), // prettier-ignore
    );
  };
  addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}
