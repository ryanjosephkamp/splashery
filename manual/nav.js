// The manual's contents button (the same look as the quick outline on the site's long pages; see
// site/assets/outline.js). It starts closed. A tap on it opens the list of chapters; Escape, a tap
// outside, or picking a link closes it. Without script the list stays shut and the Previous and
// Next buttons and the contents on the first page still lead everywhere.

const bar = document.querySelector(".manual-nav");
if (bar) {
  const toggle = bar.querySelector(".outline-toggle");
  const panel = bar.querySelector(".outline-panel");
  document.documentElement.classList.add("has-outline");
  document.documentElement.style.setProperty("--outline-h", `${Math.round(toggle.offsetHeight)}px`);
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) panel.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  bar.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !bar.contains(e.target)) setOpen(false);
  });
  bar.addEventListener("focusout", (e) => {
    if (!panel.hidden && e.relatedTarget && !bar.contains(e.relatedTarget)) setOpen(false);
  });
  // A link to a place on this page closes the list and moves focus to the place.
  panel.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    setOpen(false);
    if (a.hash && a.pathname === location.pathname) {
      const target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (target) {
        target.tabIndex = -1;
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    }
  });
}
