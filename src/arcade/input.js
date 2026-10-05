// Lane Arcade: one input for every device. Keys, the mouse, touch (drags,
// swipes and an on-screen pad) and game controllers (the Gamepad API needs
// no permission) all become the same few actions a game reads each step:
//
//   left right up down   held directions (also input.axis, -1..1 each way)
//   fire alt             the two action buttons
//   turnL turnR          turn the view (3D games)
//   pause view restart   handled by the runtime (Esc leaves play mode)
//
// input.pointer is where a finger or the mouse is on the stage (0..1 across
// and down), while it is down or (for a mouse) while it hovers; games that
// steer by pointing (a paddle under the finger) read it. input.swipe is the
// last swipe's direction ("left", "right", "up", "down"), cleared after
// each step that reads it.

const KEYS = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "fire",
  Enter: "fire",
  KeyX: "alt",
  ShiftLeft: "alt",
  ShiftRight: "alt",
  KeyQ: "turnL",
  KeyE: "turnR",
  KeyP: "pause",
  KeyV: "view",
  KeyR: "restart",
  Escape: "exit",
};

// Standard gamepad mapping: A, B, X, Y, LB, RB, LT, RT, Back, Start, L3, R3, D-pad.
const PAD_BUTTONS = { 0: "fire", 1: "alt", 2: "alt", 3: "view", 4: "turnL", 5: "turnR", 9: "pause", 8: "restart", 12: "up", 13: "down", 14: "left", 15: "right" }; // prettier-ignore

const COMMANDS = new Set(["pause", "view", "restart", "exit"]);

export const ACTIONS = ["left", "right", "up", "down", "fire", "alt", "turnL", "turnR"];

export class Input {
  // surface: the element that takes pointer play (the HUD's play area).
  constructor(surface) {
    this.surface = surface;
    this.held = new Set(); // from keys
    this.padHeld = new Set(); // from the on-screen pad
    this.gpHeld = new Set(); // from a game controller
    this.edges = []; // actions pressed since the last step
    this.axis = [0, 0];
    this.pointer = null; // { x, y, down, kind }
    this.swipe = null;
    this.taps = 0; // taps on the play area since the last read
    this.active = false; // takes the keyboard (the game is in play or chosen)
    this.lastDevice = "keys";
    this.gpPrev = new Set();
    this.listeners = [];
    const on = (t, type, fn, opts) => {
      t.addEventListener(type, fn, opts);
      this.listeners.push(() => t.removeEventListener(type, fn, opts));
    };
    // Keys go to the game first (capture), only while it is active and the
    // person is not typing in a box.
    const key = (e) => {
      if (!this.active || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = KEYS[e.code] || (e.key === " " ? "fire" : null);
      if (!a) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.lastDevice = "keys";
      if (e.type === "keydown") {
        // The runtime's own commands act at once (pause, view, restart, leave).
        if (COMMANDS.has(a)) {
          if (!e.repeat) this.onCommand?.(a);
          return;
        }
        if (!e.repeat) {
          this.edges.push(a);
          this.onPress?.(a);
        }
        this.held.add(a);
      } else this.held.delete(a);
    };
    on(window, "keydown", key, { capture: true });
    on(window, "keyup", key, { capture: true });
    on(window, "blur", () => {
      this.held.clear();
      this.padHeld.clear();
    });
    // Pointer play on the surface.
    const pts = new Map();
    const where = (e) => {
      const r = surface.getBoundingClientRect();
      return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }; // prettier-ignore
    };
    on(surface, "pointerdown", (e) => {
      if (e.target !== surface) return;
      surface.setPointerCapture?.(e.pointerId);
      const p = where(e);
      pts.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: e.timeStamp, moved: 0 });
      this.pointer = { ...p, down: true, kind: e.pointerType };
      this.lastDevice = e.pointerType === "touch" ? "touch" : "mouse";
      e.preventDefault();
    });
    on(surface, "pointermove", (e) => {
      const p = where(e);
      const s = pts.get(e.pointerId);
      if (s) {
        s.moved = Math.max(s.moved, Math.hypot(p.x - s.x0, (p.y - s.y0) * (surface.clientHeight / Math.max(1, surface.clientWidth)))); // prettier-ignore
        s.x = p.x;
        s.y = p.y;
        this.pointer = { ...p, down: true, kind: e.pointerType };
        // A quick flick is a swipe (snake turns), once per drag leg.
        const dx = p.x - s.x0;
        const dy = (p.y - s.y0) * (surface.clientHeight / Math.max(1, surface.clientWidth));
        if (Math.hypot(dx, dy) > 0.06) {
          this.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"; // prettier-ignore
          s.x0 = p.x;
          s.y0 = p.y;
        }
      } else if (e.pointerType === "mouse") {
        this.pointer = { ...p, down: false, kind: "mouse" };
        this.lastDevice = "mouse";
      }
    });
    const up = (e) => {
      const s = pts.get(e.pointerId);
      if (!s) return;
      pts.delete(e.pointerId);
      if (s.moved < 0.025 && e.timeStamp - s.t0 < 400) this.taps++;
      if (!pts.size) this.pointer = e.pointerType === "mouse" ? { ...where(e), down: false, kind: "mouse" } : null; // prettier-ignore
    };
    on(surface, "pointerup", up);
    on(surface, "pointercancel", up);
    on(surface, "pointerleave", (e) => {
      if (e.pointerType === "mouse" && !pts.size) this.pointer = null;
    });
    on(surface, "contextmenu", (e) => e.preventDefault());
  }

  // The on-screen pad's buttons call this.
  pad(action, down) {
    this.lastDevice = "touch";
    if (down) {
      if (!this.padHeld.has(action)) this.edges.push(action);
      this.padHeld.add(action);
    } else this.padHeld.delete(action);
  }

  isHeld(a) {
    return this.held.has(a) || this.padHeld.has(a) || this.gpHeld.has(a);
  }

  // Reads the game controllers (once a frame).
  pollGamepads() {
    const pads = navigator.getGamepads?.() || [];
    const now = new Set();
    let ax = 0;
    let ay = 0;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      gp.buttons.forEach((b, i) => {
        if (b.pressed && PAD_BUTTONS[i]) now.add(PAD_BUTTONS[i]);
      });
      const x = gp.axes[0] || 0;
      const y = gp.axes[1] || 0;
      if (Math.abs(x) > 0.25) ax = x;
      if (Math.abs(y) > 0.25) ay = y;
    }
    if (ax < -0.5) now.add("left");
    if (ax > 0.5) now.add("right");
    if (ay < -0.5) now.add("up");
    if (ay > 0.5) now.add("down");
    for (const a of now) {
      if (this.gpPrev.has(a)) continue;
      if (COMMANDS.has(a)) this.onCommand?.(a);
      else this.edges.push(a);
    }
    if (now.size) this.lastDevice = "pad";
    this.gpPrev = now;
    this.gpHeld = now;
    this.gpAxis = [ax, ay];
  }

  // The state a game step reads; `consume` clears the edges and swipe.
  frame() {
    const h = (a) => this.isHeld(a);
    const kx = (h("right") ? 1 : 0) - (h("left") ? 1 : 0);
    const ky = (h("up") ? 1 : 0) - (h("down") ? 1 : 0);
    const g = this.gpAxis || [0, 0];
    this.axis = [Math.abs(g[0]) > Math.abs(kx) ? g[0] : kx, Math.abs(g[1]) > Math.abs(ky) ? -g[1] : ky]; // prettier-ignore
    return this;
  }

  // Takes the presses since the last call (each is seen once).
  takeEdges() {
    const e = this.edges;
    this.edges = [];
    return e;
  }

  takeSwipe() {
    const s = this.swipe;
    this.swipe = null;
    return s;
  }

  takeTaps() {
    const t = this.taps;
    this.taps = 0;
    return t;
  }

  clear() {
    this.held.clear();
    this.padHeld.clear();
    this.edges = [];
    this.swipe = null;
    this.taps = 0;
  }

  destroy() {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}

function typing(el) {
  if (!el || !el.tagName) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
}
