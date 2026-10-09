// Lane Arcade: the game's screen furniture, drawn over the stage as plain
// HTML: the game's own stats (score, lives, level, coins: whatever it
// declares), the best score on this device, the buttons (Play for the whole
// page, the 2D/3D switch, pause, restart, the controls card, leave), a
// message in the middle ("Tap to play", "Paused", "Game over") and, on a
// touch screen, an on-screen pad with the buttons the game asks for.
//
// It lives beside the canvas (in the page, or in the <splashery-toy>
// element's shadow root) and brings its own styles.

const CSS = `
.arc-root { position: fixed; z-index: 1; pointer-events: none; font: 600 14px/1.25 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #fff; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.arc-root.arc-shadow { position: absolute; inset: 0; }
.arc-root * { box-sizing: border-box; }
.arc-surface { position: absolute; inset: 0; pointer-events: auto; touch-action: none; cursor: crosshair; outline: none; }
.arc-top { position: absolute; left: 8px; right: 8px; top: 8px; display: flex; gap: 6px; align-items: flex-start; justify-content: space-between; pointer-events: none; }
.arc-stats { display: flex; flex-wrap: wrap; gap: 6px; max-width: 62%; }
.arc-chip { padding: 4px 9px; border-radius: 999px; background: rgba(12, 14, 20, 0.62); border: 1px solid rgba(255,255,255,0.16);
  font-variant-numeric: tabular-nums; white-space: nowrap; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.arc-chip b { font-weight: 800; margin-left: 4px; }
.arc-chip.arc-best { opacity: 0.85; }
.arc-buttons { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; pointer-events: auto; }
.arc-btn { min-width: 36px; height: 36px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22);
  background: rgba(12, 14, 20, 0.66); color: #fff; font: inherit; cursor: pointer; touch-action: manipulation;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.arc-btn svg { display: block; margin: auto; }
.arc-btn:hover { background: rgba(40, 44, 56, 0.8); }
.arc-btn:focus-visible { outline: 2px solid #8fb6ff; outline-offset: 2px; }
.arc-btn.arc-view { min-width: 64px; font-weight: 800; letter-spacing: 0.02em; }
.arc-btn.arc-view[aria-pressed="true"] { background: rgba(70, 110, 220, 0.85); }
.arc-msg { position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%); max-width: min(86%, 420px); padding: 14px 18px;
  border-radius: 16px; background: rgba(12, 14, 20, 0.72); text-align: center; pointer-events: none;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.arc-msg h2 { margin: 0 0 4px; font-size: 22px; font-weight: 800; }
.arc-msg p { margin: 2px 0; font-weight: 500; opacity: 0.92; }
.arc-help { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 380px); max-height: 80%; overflow: auto;
  padding: 14px 16px; border-radius: 16px; background: rgba(12, 14, 20, 0.9); pointer-events: auto; }
.arc-help h3 { margin: 0 0 8px; font-size: 16px; }
.arc-help dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-weight: 500; }
.arc-help dt { font-weight: 800; }
.arc-help dd { margin: 0; }
.arc-pad { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 12px; pointer-events: none; }
.arc-pad-group { display: grid; gap: 8px; pointer-events: auto; }
.arc-pad-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; pointer-events: none; }
.arc-pad-util { display: flex; gap: 6px; pointer-events: auto; }
.arc-pad > .arc-pad-util { align-self: flex-end; margin: 0 6px 7px; }
.arc-pad-util:empty { display: none; }
.arc-pad-util .arc-btn { height: 40px; min-width: 44px; }
.arc-pad-util .arc-btn.arc-view { min-width: 58px; }
body.app .arc-root[data-playmode="false"] .arc-pad-side { margin-right: 48px; }
/* In the app's own view on a phone, its ▶ beside the stage plays and pauses the game. */
@media (max-width: 760px) { body.app .arc-root[data-playmode="false"] .arc-pad-util .arc-pause { display: none; } }
@media (max-width: 420px) { .arc-pad > .arc-pad-util .arc-btn { min-width: 40px; padding: 0 8px; } .arc-pad > .arc-pad-util .arc-btn.arc-view { min-width: 48px; } }
.arc-pad-dir { grid-template-columns: repeat(3, 54px); grid-template-rows: repeat(2, 54px); }
.arc-pad-row { grid-auto-flow: column; }
.arc-pad-col { grid-auto-flow: row; justify-items: center; }
.arc-key { width: 54px; height: 54px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.28); background: rgba(12, 14, 20, 0.5);
  color: #fff; font: 800 20px/1 ui-sans-serif, system-ui, sans-serif; touch-action: none; }
.arc-key.arc-down { background: rgba(90, 130, 240, 0.75); }
.arc-key.arc-fire { width: 66px; height: 66px; border-radius: 50%; font-size: 15px; }
.arc-key.arc-long { font-size: 12px; letter-spacing: -0.01em; }
.arc-pad-many .arc-key { width: 46px; height: 46px; font-size: 17px; }
.arc-pad-many .arc-key.arc-fire { width: 50px; height: 50px; font-size: 13px; }
.arc-pad-many .arc-pad-dir { grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 46px); }
.arc-choices { position: absolute; left: 8px; right: 8px; top: 92px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; pointer-events: none; }
.arc-root[data-playmode="true"] .arc-choices { top: 52px; }
body.app .arc-root[data-playmode="false"] .arc-choices { top: 148px; }
.arc-choice { pointer-events: auto; height: 30px; padding: 0 10px 0 6px; font-size: 13px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); background: rgba(12, 14, 20, 0.66);
  color: #fff; font: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; touch-action: manipulation; }
.arc-choice i { width: 16px; height: 16px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.5); }
.arc-choice[aria-pressed="true"] { background: rgba(70, 110, 220, 0.9); border-color: #cfe0ff; }
.arc-hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); padding: 3px 10px; border-radius: 999px; font-weight: 500; font-size: 12px;
  background: rgba(12, 14, 20, 0.5); white-space: nowrap; pointer-events: none; opacity: 0.9; }
.arc-root[data-touch="true"] .arc-choices { position: absolute; left: 8px; right: 8px; top: 92px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; pointer-events: none; }
.arc-root[data-playmode="true"] .arc-choices { top: 52px; }
body.app .arc-root[data-playmode="false"] .arc-choices { top: 148px; }
.arc-choice { pointer-events: auto; height: 30px; padding: 0 10px 0 6px; font-size: 13px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); background: rgba(12, 14, 20, 0.66);
  color: #fff; font: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; touch-action: manipulation; }
.arc-choice i { width: 16px; height: 16px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.5); }
.arc-choice[aria-pressed="true"] { background: rgba(70, 110, 220, 0.9); border-color: #cfe0ff; }
.arc-hint { display: none; }
.arc-root[data-touch="false"] .arc-pad { display: none; }
.arc-root[data-playmode="false"] .arc-exit { display: none; }
body.app .arc-root[data-playmode="false"] .arc-top { top: 64px; }
@media (max-width: 760px) { body.app .arc-root[data-playmode="false"] .arc-top { top: 84px; } }
.arc-root[data-playmode="true"] .arc-enter { display: none; }
.arc-root [hidden] { display: none !important; }
html.arc-play, html.arc-play body { overflow: hidden !important; }
html.arc-play body > *:not(.arc-root):not(.arc-canvas) { visibility: hidden !important; }
html.arc-play .arc-canvas { position: fixed !important; inset: 0 !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; z-index: 2147482000 !important; visibility: visible !important; }
html.arc-play .arc-root { z-index: 2147482001 !important; }
@media (max-width: 420px) { .arc-btn { min-width: 34px; height: 34px; padding: 0 8px; } .arc-chip { padding: 3px 8px; font-size: 13px; } }
`;

const PLAY_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`; // prettier-ignore
const PAUSE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z" fill="currentColor"/></svg>`; // prettier-ignore

const ARROWS = { left: "◀", right: "▶", up: "▲", down: "▼" };

export class Hud {
  // canvas: the stage's canvas. game: the recipe's arcade block. on: the
  // runtime's handlers (play, view, pause, restart, exit, pad(action, down)).
  constructor(canvas, game, on) {
    this.canvas = canvas;
    this.game = game;
    const root = canvas.getRootNode();
    this.shadow = root instanceof ShadowRoot;
    const styleHost = this.shadow ? root : document.head;
    if (!styleHost.querySelector?.("style[data-arcade]")) {
      const st = document.createElement("style");
      st.dataset.arcade = "";
      st.textContent = CSS;
      styleHost.appendChild(st);
    }
    const el = document.createElement("div");
    el.className = "arc-root" + (this.shadow ? " arc-shadow" : "");
    el.dataset.touch = String(matchMedia?.("(pointer: coarse)").matches ?? false);
    el.dataset.playmode = "false";
    el.innerHTML = `
      <div class="arc-surface" tabindex="0" role="application"></div>
      <div class="arc-top">
        <div class="arc-stats" aria-live="polite"></div>
        <div class="arc-buttons">
          <button class="arc-btn arc-view" type="button" aria-pressed="false" title="Switch between 2D and 3D (V)">3D</button>
          <button class="arc-btn arc-pause" type="button"></button>
          <button class="arc-btn arc-restart" type="button" title="Start again (R)" aria-label="Start again">↺</button>
          <button class="arc-btn arc-file" type="button" hidden></button>
          <button class="arc-btn arc-controls" type="button" title="Controls" aria-label="Controls">?</button>
          <button class="arc-btn arc-enter" type="button" title="Play on the whole page">⛶ Play</button>
          <button class="arc-btn arc-exit" type="button" title="Leave (Esc)" aria-label="Leave">✕</button>
        </div>
      </div>
      <div class="arc-msg" hidden></div>
      <div class="arc-help" hidden></div>
      <div class="arc-choices" hidden></div>
      <div class="arc-pad"></div>
      <div class="arc-hint"></div>`;
    canvas.after(el);
    this.el = el;
    this.surface = el.querySelector(".arc-surface");
    this.statsEl = el.querySelector(".arc-stats");
    this.msgEl = el.querySelector(".arc-msg");
    this.helpEl = el.querySelector(".arc-help");
    this.viewBtn = el.querySelector(".arc-view");
    this.pauseBtn = el.querySelector(".arc-pause");
    this.hintEl = el.querySelector(".arc-hint");
    this.viewBtn.hidden = !game.views;
    const click = (sel, fn) =>
      el.querySelector(sel).addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
    click(".arc-view", on.view);
    click(".arc-pause", on.pause);
    click(".arc-restart", on.restart);
    click(".arc-enter", on.play);
    click(".arc-exit", on.exit);
    click(".arc-controls", () => this.toggleHelp());
    // A game that opens a file of the person's own (Note Rider's song).
    const fileBtn = el.querySelector(".arc-file");
    if (game.file && on.file) {
      fileBtn.hidden = false;
      fileBtn.textContent = game.file.label;
      fileBtn.title = game.file.title || game.file.label;
      click(".arc-file", on.file);
    }
    this.helpEl.addEventListener("click", () => this.toggleHelp(false));
    this.buildPad(game.pad || ["left", "right", "fire"], on.pad);
    this.buildHelp();
    this.buildChoices(game.choices, on.choose);
    this.hintEl.textContent = game.controls?.short || "";
    this.chips = new Map();
    this.lastStats = "";
    this.setTouch(el.dataset.touch === "true");
    this.place();
    this.ro = new ResizeObserver(() => this.place());
    this.ro.observe(canvas);
    this.onResize = () => this.place();
    addEventListener("resize", this.onResize);
    addEventListener("scroll", this.onResize, true);
  }

  // Keeps the overlay over the canvas (the page's canvas moves with the
  // panels; the element's fills its host).
  place() {
    if (this.shadow) return;
    const r = this.canvas.getBoundingClientRect();
    Object.assign(this.el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }); // prettier-ignore
  }

  buildPad(buttons, pad) {
    const box = this.el.querySelector(".arc-pad");
    const dirs = buttons.filter((b) => ARROWS[b]);
    const acts = buttons.filter((b) => !ARROWS[b]);
    const make = (a, label, cls = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `arc-key ${cls}`;
      b.textContent = label;
      b.setAttribute("aria-label", a);
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.setPointerCapture?.(e.pointerId);
        b.classList.add("arc-down");
        pad(a, true);
      };
      const up = (e) => {
        e.preventDefault();
        b.classList.remove("arc-down");
        pad(a, false);
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      return b;
    };
    const left = document.createElement("div");
    if (dirs.includes("up") || dirs.includes("down")) {
      left.className = "arc-pad-group arc-pad-dir";
      const at = { up: [1, 2], left: [2, 1], down: [2, 2], right: [2, 3] };
      for (const d of dirs) {
        const b = make(d, ARROWS[d]);
        b.style.gridRow = at[d][0];
        b.style.gridColumn = at[d][1];
        left.appendChild(b);
      }
    } else {
      left.className = "arc-pad-group arc-pad-row";
      for (const d of dirs) left.appendChild(make(d, ARROWS[d]));
    }
    const right = document.createElement("div");
    // (Arcade r3: two action buttons beside a row of three arrows stand one
    // over the other, so they fit a phone: Strata's Drop over ⟳ Turn)
    const stack = acts.length === 2 && dirs.length >= 3 && dirs.length + acts.length <= 5;
    right.className = `arc-pad-group ${stack ? "arc-pad-col" : "arc-pad-row"}`;
    const names = this.game.padLabels || {};
    for (const a of acts) {
      const label = names[a] || (a === "fire" ? "●" : a);
      right.appendChild(make(a, label, label.length > 4 ? "arc-fire arc-long" : "arc-fire"));
    }
    // On a touch screen the 2D/3D switch and play/pause sit down here by
    // the thumbs rather than at the top (setTouch moves them): on the
    // bottom row between the arrows and the action buttons, or, when a
    // game's pad has many buttons, over the action buttons.
    const many = dirs.length + acts.length > 5;
    const side = document.createElement("div");
    side.className = "arc-pad-side";
    this.utilEl = document.createElement("div");
    this.utilEl.className = "arc-pad-util";
    if (many) side.append(this.utilEl);
    if (acts.length) side.append(right);
    if (many) box.append(left, side);
    else box.append(left, this.utilEl, side);
    // Many buttons (a 3D puzzle's turns and tips): smaller, so they fit a phone.
    if (many) box.classList.add("arc-pad-many");
  }

  // A game's own choices (a material to paint with): a row of buttons.
  buildChoices(choices, choose) {
    const box = this.el.querySelector(".arc-choices");
    this.choiceEls = [];
    if (!choices?.length) return;
    box.hidden = false;
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "arc-choice";
      b.innerHTML = `<i style="background:${esc(c.color || "#888")}"></i>${esc(c.label)}`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        choose?.(c.id);
      });
      b.dataset.id = c.id;
      box.appendChild(b);
      this.choiceEls.push(b);
    }
  }

  setChoice(id) {
    for (const b of this.choiceEls || [])
      b.setAttribute("aria-pressed", String(b.dataset.id === id));
  }

  buildHelp() {
    const c = this.game.controls || {};
    const rows = [
      ["Keys", c.keys],
      ["Mouse", c.mouse],
      ["Touch", c.touch],
      ["Controller", c.pad],
      [
        "3D view",
        this.game.look &&
          (c.look ||
            `Drag with two fingers (or the right mouse button) to look around; pinch or scroll to zoom${this.game.look.keys ? "; Q and E turn the view" : ""}.`),
      ],
      [
        "Always",
        "P pauses · R starts again · V switches 2D and 3D · Esc leaves the whole-page view",
      ],
    ].filter((r) => r[1]);
    this.helpEl.innerHTML = `<h3>${esc(this.game.title || "Controls")}</h3>${this.game.goal ? `<p>${esc(this.game.goal)}</p>` : ""}<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl><p style="opacity:.7;font-weight:500">Tap to close</p>`; // prettier-ignore
  }

  toggleHelp(show = this.helpEl.hidden) {
    this.helpEl.hidden = !show;
  }

  setTouch(on) {
    const v = String(!!on);
    if (this.el.dataset.touch === v && this.placedTouch === v) return;
    this.el.dataset.touch = v;
    this.placedTouch = v;
    // Where the hands are: at the bottom on a touch screen, at the top else.
    if (on) this.utilEl.append(this.viewBtn, this.pauseBtn);
    else this.el.querySelector(".arc-buttons").prepend(this.viewBtn, this.pauseBtn);
  }

  setPlayMode(on) {
    this.el.dataset.playmode = String(!!on);
    this.place();
  }

  setView(is3d) {
    this.viewBtn.textContent = is3d ? "2D" : "3D";
    this.viewBtn.setAttribute("aria-pressed", String(!!is3d));
    this.viewBtn.title = is3d ? "Slide back to 2D (V)" : "Slide into 3D (V)";
  }

  // One button plays and pauses: it shows ▶ while the game waits (before
  // the first go, paused, over) and pause while it plays.
  setPaused(paused) {
    if (this.shownPaused === paused) return;
    this.shownPaused = paused;
    this.pauseBtn.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    this.pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
    this.pauseBtn.title = paused ? "Play (P)" : "Pause (P)";
  }

  // stats: [{ key, label, value, icon }]
  setStats(stats) {
    const key = stats.map((s) => `${s.key}=${s.value}`).join("|");
    if (key === this.lastStats) return;
    this.lastStats = key;
    for (const s of stats) {
      let chip = this.chips.get(s.key);
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "arc-chip" + (s.key === "best" ? " arc-best" : "");
        this.statsEl.appendChild(chip);
        this.chips.set(s.key, chip);
      }
      const v = s.icon && Number.isInteger(s.value) && s.value <= 8 ? s.icon.repeat(Math.max(0, s.value)) || "–" : s.value; // prettier-ignore
      chip.innerHTML = `${esc(s.label)}<b>${esc(String(v))}</b>`;
    }
  }

  // msg: null, or { title, lines: [] }
  setMessage(msg) {
    const key = msg ? `${msg.title}|${(msg.lines || []).join("|")}` : "";
    if (key === this.lastMsg) return;
    this.lastMsg = key;
    this.msgEl.hidden = !msg;
    if (msg) this.msgEl.innerHTML = `<h2>${esc(msg.title)}</h2>${(msg.lines || []).map((l) => `<p>${esc(l)}</p>`).join("")}`; // prettier-ignore
  }

  destroy() {
    this.ro.disconnect();
    removeEventListener("resize", this.onResize);
    removeEventListener("scroll", this.onResize, true);
    this.el.remove();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); // prettier-ignore
}
