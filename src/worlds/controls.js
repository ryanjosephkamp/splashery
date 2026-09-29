// Input: keys (WASD or arrows, Shift to run), mouse drag to look, and on a
// phone a thumb stick on the left and drag to look on the right. A short
// tap or click that does not drag picks a landmark. The page's own menus
// keep the keyboard while they are open.

export class Controls {
  // canvas: the world's canvas; stick: the thumb stick's element (with a
  // .knob child); onTap(x, y): a tap or click in canvas pixels.
  constructor(canvas, { stick, onTap, onLook, onZoom } = {}) {
    this.canvas = canvas;
    this.stickEl = stick;
    this.knob = stick?.querySelector(".knob");
    this.onTap = onTap;
    this.onLook = onLook;
    this.onZoom = onZoom;
    this.keys = new Set();
    this.move = [0, 0]; // x right, y forward, each -1..1
    this.stickVec = [0, 0];
    this.pointers = new Map();
    this.enabled = true;
    this.touchSeen = false;

    this.onKey = (e) => {
      if (!this.enabled || isTyping(e.target)) return;
      const k = keyName(e);
      if (!k) return;
      if (e.type === "keydown") this.keys.add(k);
      else this.keys.delete(k);
      if (k !== "run") e.preventDefault();
    };
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.moveP(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.onZoom?.(Math.exp(e.deltaY * 0.001));
    }, { passive: false }); // prettier-ignore
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    if (stick) {
      stick.addEventListener("pointerdown", (e) => this.stickDown(e));
      stick.addEventListener("pointermove", (e) => this.stickMove(e));
      stick.addEventListener("pointerup", (e) => this.stickUp(e));
      stick.addEventListener("pointercancel", (e) => this.stickUp(e));
    }
  }

  // ---- Look and tap on the canvas --------------------------------------------

  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === "touch") this.showStick();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, moved: 0 }); // prettier-ignore
  }

  moveP(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
    if (this.pointers.size === 2) {
      // Two fingers: pinch to zoom.
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.onZoom?.(this.pinch / Math.max(1, d));
      this.pinch = d;
      return;
    }
    if (p.moved > 4) {
      const s = e.pointerType === "touch" ? 0.0065 : 0.005;
      this.onLook?.(-dx * s, dy * s);
    }
  }

  up(e, cancel = false) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    // Event times, not handler times: a slow frame can delay the handlers.
    if (!cancel && p.moved < 8 && e.timeStamp - p.t0 < 450) {
      const r = this.canvas.getBoundingClientRect();
      this.onTap?.(e.clientX - r.left, e.clientY - r.top);
    }
  }

  // ---- The thumb stick ---------------------------------------------------------

  showStick() {
    if (this.touchSeen || !this.stickEl) return;
    this.touchSeen = true;
    this.stickEl.hidden = false;
  }

  stickDown(e) {
    e.preventDefault();
    this.stickEl.setPointerCapture?.(e.pointerId);
    this.stickId = e.pointerId;
    this.stickMove(e);
  }

  stickMove(e) {
    if (e.pointerId !== this.stickId) return;
    const r = this.stickEl.getBoundingClientRect();
    const R = r.width / 2;
    let x = (e.clientX - (r.left + R)) / R;
    let y = (e.clientY - (r.top + R)) / R;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    this.stickVec = [x, -y];
    if (this.knob) this.knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
  }

  stickUp(e) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.stickVec = [0, 0];
    if (this.knob) this.knob.style.transform = "";
  }

  // ---- What the player wants now ----------------------------------------------

  // Returns { x, y, run }: x right and y forward (-1..1), run true when
  // Shift is held or the stick is pushed all the way.
  read() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has("left")) x -= 1;
    if (k.has("right")) x += 1;
    if (k.has("up")) y += 1;
    if (k.has("down")) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    let run = k.has("run");
    const [sx, sy] = this.stickVec;
    const sl = Math.hypot(sx, sy);
    if (sl > 0.12) {
      x = sx;
      y = sy;
      run = run || sl > 0.92;
    }
    return { x, y, run, amount: Math.min(1, Math.max(Math.hypot(x, y), 0)) };
  }
}

function keyName(e) {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      return "up";
    case "KeyS":
    case "ArrowDown":
      return "down";
    case "KeyA":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "ArrowRight":
      return "right";
    case "ShiftLeft":
    case "ShiftRight":
      return "run";
    default:
      return null;
  }
}

function isTyping(el) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
