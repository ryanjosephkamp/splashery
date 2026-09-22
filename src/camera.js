// Orbit camera around the toy, plus a small gesture recognizer.
//
// The camera moves; the toy stays put. State is yaw/pitch/roll/distance so it
// serialises cleanly. Motion is damped: input moves targets, the rendered
// pose eases towards them, and a released drag coasts to a stop. An idle
// turntable starts after a pause (never under prefers-reduced-motion).

const TAU = Math.PI * 2;
const PITCH_LIMIT = 1.45;

export const DEFAULT_CAMERA = Object.freeze({ yaw: 0.55, pitch: 0.28, roll: 0, distance: 5 });

export class OrbitCamera {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.home = { ...DEFAULT_CAMERA };
    this.cur = { ...DEFAULT_CAMERA };
    this.tgt = { ...DEFAULT_CAMERA };
    this.vel = { yaw: 0, pitch: 0 };
    this.minDistance = 1.3;
    this.maxDistance = 9;
    this.radius = 1;
    this.target = [0, 0, 0];
    this.follow = [0, 0, 0]; // extra target offset the camera eases towards
    this.offset = [0, 0, 0];
    this.turntable = !reducedMotion;
    this.turntableSpeed = 0.18;
    this.idleDelay = 2.5;
    this.idleFor = 0;
    this.ramp = 0;
    this.dragging = false;
    this.viewportHeight = 800;
    this.shake = { last: 0, flips: 0, sign: 0, time: 0 };
    this.onShake = null;
  }

  setTurntable(on) {
    this.turntable = !!on && !this.reducedMotion;
  }

  // Fits limits around a toy of this bounding radius.
  fit(radius, center = [0, 0, 0]) {
    this.radius = radius;
    this.target = center.slice();
    this.minDistance = radius * 1.25;
    this.maxDistance = radius * 10;
    this.home.distance = radius * DEFAULT_CAMERA.distance;
  }

  interact() {
    this.idleFor = 0;
    this.ramp = 0;
  }

  begin() {
    this.dragging = true;
    this.vel.yaw = this.vel.pitch = 0;
    this.interact();
  }

  end() {
    this.dragging = false;
    this.interact();
  }

  // Drag in CSS pixels. A full viewport-height drag turns about 1.4 turns.
  rotateBy(dx, dy, dt = 1 / 60) {
    const k = (TAU * 1.4) / Math.max(200, this.viewportHeight);
    const c = Math.cos(-this.cur.roll);
    const s = Math.sin(-this.cur.roll);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    const dYaw = -rx * k;
    const dPitch = ry * k;
    this.tgt.yaw += dYaw;
    this.tgt.pitch = clampPitch(this.tgt.pitch + dPitch);
    if (dt > 0) {
      const inv = 1 / Math.max(dt, 1 / 240);
      this.vel.yaw = this.vel.yaw * 0.5 + dYaw * inv * 0.5;
      this.vel.pitch = this.vel.pitch * 0.5 + dPitch * inv * 0.5;
    }
    this.detectShake(dYaw, dt);
    this.interact();
  }

  // Fast back-and-forth drags count as a shake.
  detectShake(dYaw, dt) {
    const now = performance.now() / 1000;
    const sh = this.shake;
    const speed = Math.abs(dYaw) / Math.max(dt, 1 / 240);
    if (speed < 5) return;
    const sign = Math.sign(dYaw);
    if (now - sh.time > 0.45) sh.flips = 0;
    if (sign !== sh.sign) {
      sh.flips++;
      sh.sign = sign;
      sh.time = now;
      if (sh.flips >= 4) {
        sh.flips = 0;
        this.onShake?.();
      }
    }
  }

  rollBy(angle) {
    this.tgt.roll = wrapAngle(this.tgt.roll + angle);
    this.interact();
  }

  zoomBy(factor) {
    this.tgt.distance = Math.min(
      this.maxDistance,
      Math.max(this.minDistance, this.tgt.distance * factor),
    );
    this.interact();
  }

  reset() {
    this.tgt = { ...this.home };
    // Take the short way round.
    this.cur.yaw = this.tgt.yaw + wrapAngle(this.cur.yaw - this.tgt.yaw);
    this.cur.roll = this.tgt.roll + wrapAngle(this.cur.roll - this.tgt.roll);
    this.vel.yaw = this.vel.pitch = 0;
    this.interact();
  }

  getState() {
    const r = (v) => Math.round(v * 1e4) / 1e4;
    return {
      yaw: r(wrapAngle(this.tgt.yaw)),
      pitch: r(this.tgt.pitch),
      roll: r(this.tgt.roll),
      distance: r(this.tgt.distance / this.radius),
    };
  }

  // Distance in the saved state is relative to the toy radius.
  setState(s, { asHome = false, snap = true } = {}) {
    const n = (v, d) => (Number.isFinite(v) ? v : d);
    const next = {
      yaw: n(s?.yaw, DEFAULT_CAMERA.yaw),
      pitch: clampPitch(n(s?.pitch, DEFAULT_CAMERA.pitch)),
      roll: wrapAngle(n(s?.roll, 0)),
      distance: Math.min(
        this.maxDistance,
        Math.max(this.minDistance, n(s?.distance, DEFAULT_CAMERA.distance) * this.radius),
      ),
    };
    this.tgt = { ...next };
    if (snap) this.cur = { ...next };
    if (asHome) this.home = { ...next };
    this.vel.yaw = this.vel.pitch = 0;
  }

  // Returns true while the pose is still changing.
  update(dt) {
    dt = Math.min(0.1, Math.max(0, dt));
    if (!this.dragging) {
      this.idleFor += dt;
      const coast = Math.abs(this.vel.yaw) + Math.abs(this.vel.pitch) > 1e-3;
      if (coast) {
        this.tgt.yaw += this.vel.yaw * dt;
        this.tgt.pitch = clampPitch(this.tgt.pitch + this.vel.pitch * dt);
        const f = Math.exp(-dt / 0.22);
        this.vel.yaw *= f;
        this.vel.pitch *= f;
      } else {
        this.vel.yaw = this.vel.pitch = 0;
      }
      if (this.turntable && this.idleFor > this.idleDelay) {
        this.ramp = Math.min(1, this.ramp + dt / 2);
        this.tgt.yaw += this.turntableSpeed * this.ramp * this.ramp * dt;
      }
    }
    const k = 1 - Math.exp(-dt / 0.075);
    let moving = false;
    const ko = 1 - Math.exp(-dt / 0.35);
    for (let i = 0; i < 3; i++) {
      const d = this.follow[i] - this.offset[i];
      if (Math.abs(d) > 1e-5) {
        this.offset[i] += d * ko;
        moving = true;
      } else {
        this.offset[i] = this.follow[i];
      }
    }
    for (const key of ["yaw", "pitch", "roll", "distance"]) {
      const d = this.tgt[key] - this.cur[key];
      if (Math.abs(d) > 1e-5) {
        this.cur[key] += d * k;
        moving = true;
      } else {
        this.cur[key] = this.tgt[key];
      }
    }
    return moving || this.isTurning();
  }

  isTurning() {
    return this.turntable && this.idleFor > this.idleDelay;
  }

  // World-space pose: position, rotation quaternion (x, y, z, w) and axes.
  pose() {
    const { yaw, pitch, roll, distance } = this.cur;
    const q = quatMul(
      quatMul(axisAngle([0, 1, 0], yaw), axisAngle([1, 0, 0], -pitch)),
      axisAngle([0, 0, 1], roll),
    );
    const back = rotate(q, [0, 0, 1]);
    const t = [
      this.target[0] + this.offset[0],
      this.target[1] + this.offset[1],
      this.target[2] + this.offset[2],
    ];
    return {
      position: [t[0] + back[0] * distance, t[1] + back[1] * distance, t[2] + back[2] * distance],
      rotation: q,
      right: rotate(q, [1, 0, 0]),
      up: rotate(q, [0, 1, 0]),
      forward: [-back[0], -back[1], -back[2]],
    };
  }
}

function clampPitch(p) {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, p));
}

function wrapAngle(a) {
  return ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

function axisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

function quatMul(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function rotate(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

// ---- Gestures -----------------------------------------------------------------
// Turns pointer and wheel events into gestures. The host decides whether a
// single-pointer drag is a tool stroke or an orbit through classify(event).

export class Gestures {
  constructor(element, handlers) {
    this.el = element;
    this.h = handlers;
    this.pointers = new Map();
    this.gesture = null; // "tool" | "orbit" | "pinch"
    this.primaryId = null;
    this.lastTap = { time: -1e9, x: 0, y: 0 };
    this.moved = 0;
    this.pinch = null;
    this.listeners = [];
    const on = (type, fn, opts) => {
      element.addEventListener(type, fn, opts);
      this.listeners.push([type, fn, opts]);
    };
    on("pointerdown", (e) => this.down(e));
    on("pointermove", (e) => this.move(e));
    on("pointerup", (e) => this.up(e));
    on("pointercancel", (e) => this.up(e));
    on("lostpointercapture", (e) => this.up(e));
    on(
      "wheel",
      (e) => {
        // A handler returning false leaves the wheel to the page (embeds).
        if (this.h.onWheel?.(e) !== false) e.preventDefault();
      },
      { passive: false },
    );
    on("contextmenu", (e) => e.preventDefault());
    on("dblclick", (e) => {
      e.preventDefault();
      if (this.gesture !== "tool") this.h.onDoubleTap?.(e);
    });
  }

  dispose() {
    for (const [type, fn, opts] of this.listeners) this.el.removeEventListener(type, fn, opts);
    this.listeners = [];
  }

  down(e) {
    if (e.pointerType === "mouse" && e.button > 2) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    this.h.onInteract?.(e);
    if (this.pointers.size === 1) {
      this.primaryId = e.pointerId;
      this.moved = 0;
      this.downAt = e.timeStamp;
      this.multi = false;
      const lt = this.lastTap;
      const isDouble =
        e.pointerType !== "mouse" &&
        e.timeStamp - lt.time < 320 &&
        Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 24;
      this.lastTap = { time: e.timeStamp, x: e.clientX, y: e.clientY };
      const kind = this.h.classify ? this.h.classify(e) : "orbit";
      if (isDouble && kind === "orbit") {
        this.lastTap.time = -1e9;
        this.gesture = "orbit";
        this.h.onDoubleTap?.(e);
        this.h.onOrbitStart?.(e);
        return;
      }
      this.gesture = kind;
      if (kind === "tool") this.h.onToolStart?.(e);
      else this.h.onOrbitStart?.(e);
    } else if (this.pointers.size === 2) {
      this.multi = true;
      if (this.gesture === "tool") this.h.onToolEnd?.(e, true);
      else if (this.gesture === "orbit") this.h.onOrbitEnd?.(e);
      this.gesture = "pinch";
      this.pinch = this.pinchState();
      this.h.onPinchStart?.();
    }
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      ang: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      this.h.onHover?.(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dt = Math.max(1, e.timeStamp - p.t) / 1000;
    this.moved += Math.hypot(dx, dy);
    if (this.gesture === "pinch" && this.pointers.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      p.t = e.timeStamp;
      const s = this.pinchState();
      const prev = this.pinch;
      let dAng = s.ang - prev.ang;
      if (dAng > Math.PI) dAng -= TAU;
      if (dAng < -Math.PI) dAng += TAU;
      this.h.onPinch?.({
        scale: prev.dist > 0 ? s.dist / prev.dist : 1,
        dx: s.cx - prev.cx,
        dy: s.cy - prev.cy,
        twist: dAng,
        dt,
      });
      this.pinch = s;
      return;
    }
    if (e.pointerId === this.primaryId) {
      if (this.gesture === "tool") this.h.onToolMove?.(e);
      else if (this.gesture === "orbit") this.h.onOrbit?.(dx, dy, dt, e);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = e.timeStamp;
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.gesture === "tool" && e.pointerId === this.primaryId) {
      this.h.onToolEnd?.(e, false);
      this.gesture = null;
    } else if (this.gesture === "orbit" && e.pointerId === this.primaryId) {
      this.h.onOrbitEnd?.(e);
      this.gesture = null;
    } else if (this.gesture === "pinch" && this.pointers.size < 2) {
      this.h.onPinchEnd?.();
      if (this.pointers.size === 1) {
        this.primaryId = [...this.pointers.keys()][0];
        this.gesture = "orbit";
        this.h.onOrbitStart?.(e);
      } else {
        this.gesture = null;
      }
    }
    if (this.pointers.size === 0) {
      this.gesture = null;
      this.primaryId = null;
      if (this.moved > 12) this.lastTap.time = -1e9;
      // A short press that barely moved is a tap.
      if (
        e.type === "pointerup" &&
        !this.multi &&
        this.moved < 10 &&
        e.timeStamp - this.downAt < 400
      )
        this.h.onTap?.(e);
    }
  }
}
