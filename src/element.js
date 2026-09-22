// <splashery-toy>: embeds a Splashery toy without an iframe.
//
//   <script type="module" src="https://ryanjosephkamp.github.io/splashery/src/element.js"></script>
//   <splashery-toy toy="cactus"></splashery-toy>
//
// Attributes (all optional):
//   scene       a shared scene (the part after "#s=" in a Splashery link)
//   toy         a shelf toy id when there is no scene (cactus, strawberry,
//               cookie, bee, blob, donut, knot, planet)
//   theme       auto | light | dark (auto follows the page, including the
//               personal site's paper-theme-change event)
//   background  transparent | page | #rrggbb
//   autoplay    none | breeze | pokes | twist | dissolve
//   turntable   "off" stops the idle spin
//   label       accessible description of the toy
//
// The element sizes itself to 4:3 unless you give it a height. It starts
// when it scrolls into view and pauses when it leaves.

import { Viewer, NoGPUError } from "./viewer.js";

const STYLE = `
:host { display: block; position: relative; aspect-ratio: 4 / 3; min-height: 160px; contain: content;
  --sp-page: #ffffff; --sp-ink: #111111; --sp-accent: #0b4f9c; --sp-line: rgba(0,0,0,0.14);
  --sp-paper: rgba(255,255,255,0.9); color: var(--sp-ink);
  font: 12px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
:host([data-theme="dark"]) { --sp-page: #101010; --sp-ink: #f2f2f2; --sp-accent: #b8ccff;
  --sp-line: rgba(255,255,255,0.18); --sp-paper: rgba(16,16,16,0.9); }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none;
  cursor: grab; border-radius: inherit; outline-offset: -2px; }
canvas:focus-visible { outline: 2px solid var(--sp-accent); }
a { position: absolute; right: 8px; bottom: 8px; padding: 3px 10px; border-radius: 999px;
  background: var(--sp-paper); border: 1px solid var(--sp-line); color: var(--sp-accent); text-decoration: none; }
a:focus-visible { outline: 2px solid var(--sp-accent); outline-offset: 2px; }
.status { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 150px); padding: 3px 10px;
  border-radius: 999px; background: var(--sp-paper); border: 1px solid var(--sp-line); }
.fallback { position: absolute; inset: 0; display: grid; place-content: center; gap: 8px; padding: 12px;
  text-align: center; background: var(--sp-page); }
.fallback svg { width: min(60%, 220px); margin: 0 auto; }
[hidden] { display: none !important; }
`;

const POSTER = `<svg viewBox="0 0 320 240" role="img" aria-label="A toy made of coloured splats"><g opacity="0.9">
<ellipse cx="118" cy="104" rx="62" ry="48" fill="#ff5fa2"/><ellipse cx="196" cy="96" rx="54" ry="58" fill="#7bdff2"/>
<ellipse cx="160" cy="160" rx="70" ry="46" fill="#ffd166"/><ellipse cx="108" cy="160" rx="26" ry="20" fill="#b388ff"/>
<ellipse cx="226" cy="158" rx="22" ry="16" fill="#0b4f9c"/></g></svg>`;

function pageTheme() {
  const el = document.documentElement;
  const t = el.dataset.resolvedTheme || el.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

class SplasheryToy extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <canvas tabindex="0" role="img"></canvas>
      <a target="_blank" rel="noopener" href="https://ryanjosephkamp.github.io/splashery/">Open in Splashery</a>
      <div class="status" role="status" aria-live="polite" hidden></div>
      <div class="fallback" hidden>${POSTER}<p>This browser cannot start WebGL2 or WebGPU, so the toy cannot be shown here.</p></div>`;
    this.canvas = root.querySelector("canvas");
    this.link = root.querySelector("a");
    this.status = root.querySelector(".status");
    this.fallback = root.querySelector(".fallback");
    this.viewer = null;
    this.started = false;
    this.onPageTheme = (e) => {
      if (this.getAttribute("theme") && this.getAttribute("theme") !== "auto") return;
      const t = e?.detail?.resolved || pageTheme();
      this.viewer?.setTheme(t);
      this.dataset.theme = t;
    };
  }

  connectedCallback() {
    this.canvas.setAttribute(
      "aria-label",
      this.getAttribute("label") ||
        "A toy made of splats. Drag to turn it; pinch or Ctrl and scroll to zoom.",
    );
    document.addEventListener("paper-theme-change", this.onPageTheme);
    this.media = matchMedia("(prefers-color-scheme: dark)");
    this.media.addEventListener("change", this.onPageTheme);
    this.dataset.theme = this.forcedTheme() || pageTheme();
    // Start when visible, pause when scrolled away.
    this.observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !this.started) this.start();
      if (this.viewer?.player.stage) this.viewer.player.setPaused(!visible);
    });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    document.removeEventListener("paper-theme-change", this.onPageTheme);
    this.media?.removeEventListener("change", this.onPageTheme);
    this.observer?.disconnect();
    this.viewer?.destroy();
    this.viewer = null;
    this.started = false;
  }

  forcedTheme() {
    const t = this.getAttribute("theme");
    return t === "light" || t === "dark" ? t : null;
  }

  say(text) {
    this.status.hidden = !text;
    this.status.textContent = text || "";
    if (text) setTimeout(() => (this.status.hidden = true), 6000);
  }

  async start() {
    this.started = true;
    const autoplay = this.getAttribute("autoplay");
    this.viewer = new Viewer(this.canvas, {
      scene: this.getAttribute("scene"),
      toy: this.getAttribute("toy"),
      theme: this.forcedTheme(),
      background: this.getAttribute("background"),
      autoplay: autoplay || undefined,
      turntable: this.getAttribute("turntable") === "off" ? false : undefined,
      onStatus: (t) => this.say(t),
      onTheme: (t) => (this.dataset.theme = t),
    });
    this.viewer.player.hostTheme = pageTheme();
    try {
      await this.viewer.start();
      this.link.href = this.viewer.openURL();
      this.dataset.ready = "true";
    } catch (err) {
      if (!(err instanceof NoGPUError))
        console.info("splashery-toy could not start:", err?.message || err);
      this.fallback.hidden = false;
      this.canvas.hidden = true;
      this.dataset.ready = "true";
    }
    this.dispatchEvent(new CustomEvent("splashery-ready", { bubbles: true }));
  }
}

if (!customElements.get("splashery-toy")) customElements.define("splashery-toy", SplasheryToy);

export { SplasheryToy };
