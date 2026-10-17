// Walking owns its listeners and releases them together when the dialog closes.
const typing = (e) =>
  /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY|A)$/.test(e.target?.tagName) ||
  e.target?.isContentEditable;
export class WalkControls {
  constructor(canvas, stick, { onLook, onTap, onStop } = {}) {
    this.canvas = canvas;
    this.stick = stick;
    this.keys = new Set();
    this.stickVec = [0, 0];
    this.pointers = new Map();
    this.onStop = onStop;
    this.abort = new AbortController();
    const on = (el, name, fn, opts = {}) =>
      el.addEventListener(name, fn, { ...opts, signal: this.abort.signal });
    on(
      window,
      "keydown",
      (e) => {
        if (typing(e) || !/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.keys.add(e.code);
        onStop?.();
      },
      { capture: true },
    );
    on(window, "keyup", (e) => this.keys.delete(e.code), { capture: true });
    on(window, "blur", () => this.clear());
    on(document, "focusin", (e) => {
      if (typing(e)) this.clear();
    });
    on(document, "visibilitychange", () => {
      if (document.hidden) this.clear();
    });
    on(canvas, "pointerdown", (e) => {
      if (document.pointerLockElement === canvas) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* Synthetic input has no active pointer. */
      }
      this.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        x0: e.clientX,
        y0: e.clientY,
        time: e.timeStamp,
        moved: 0,
      });
    });
    on(canvas, "pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
      if (p.moved > 5) onLook?.(-dx * 0.004, dy * 0.004);
      p.x = e.clientX;
      p.y = e.clientY;
    });
    on(document, "mousemove", (e) => {
      if (document.pointerLockElement === canvas)
        onLook?.(-e.movementX * 0.0025, e.movementY * 0.0025);
    });
    on(document, "pointerlockchange", () => {
      this.clear();
    });
    const up = (e, cancel = false) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!cancel && p && p.moved < 8 && e.timeStamp - p.time < 450) {
        const r = canvas.getBoundingClientRect();
        onTap?.(e.clientX - r.left, e.clientY - r.top);
      }
    };
    on(canvas, "pointerup", (e) => up(e));
    on(canvas, "pointercancel", (e) => up(e, true));
    on(canvas, "contextmenu", (e) => e.preventDefault());
    const move = (e) => {
      if (this.stickId !== e.pointerId) return;
      const r = stick.getBoundingClientRect(),
        radius = r.width / 2;
      let x = (e.clientX - r.left - radius) / radius,
        y = (e.clientY - r.top - radius) / radius;
      const len = Math.max(1, Math.hypot(x, y));
      x /= len;
      y /= len;
      this.stickVec = [x, -y];
      stick.firstElementChild.style.transform = `translate(${x * 25}px, ${y * 25}px)`;
    };
    on(stick, "pointerdown", (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch {
        /* See above. */
      }
      onStop?.();
      move(e);
    });
    on(stick, "pointermove", move);
    const end = (e) => {
      if (this.stickId === e.pointerId) {
        this.stickId = null;
        this.stickVec = [0, 0];
        stick.firstElementChild.style.transform = "";
      }
    };
    on(stick, "pointerup", end);
    on(stick, "pointercancel", end);
    on(stick, "lostpointercapture", end);
  }
  read() {
    const k = this.keys;
    let x =
      Number(k.has("KeyD") || k.has("ArrowRight")) - Number(k.has("KeyA") || k.has("ArrowLeft"));
    let y = Number(k.has("KeyW") || k.has("ArrowUp")) - Number(k.has("KeyS") || k.has("ArrowDown"));
    if (Math.hypot(...this.stickVec) > 0.12) [x, y] = this.stickVec;
    const len = Math.max(1, Math.hypot(x, y));
    return { x: x / len, y: y / len };
  }
  clear() {
    this.onStop?.();
    this.keys.clear();
    this.stickVec = [0, 0];
    this.stickId = null;
    this.pointers.clear();
    if (this.stick) this.stick.firstElementChild.style.transform = "";
  }
  destroy() {
    this.clear();
    this.abort.abort();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
