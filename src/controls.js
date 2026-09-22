// Ball-centric orbit: dragging turns the planet in front of a fixed camera
// on +Z, so world "down" stays screen-down and drips follow the turn.
// Also a small gesture recognizer shared by the app and the embed player.

import { Quaternion, Vector3 } from "three";

const _axisX = new Vector3(1, 0, 0);
const _axisY = new Vector3(0, 1, 0);
const _axisZ = new Vector3(0, 0, 1);
const _dq = new Quaternion();

export class BallControls {
  constructor({ radius = 1, reducedMotion = false } = {}) {
    this.radius = radius;
    this.rotation = new Quaternion();
    this.distance = 3.2;
    this.targetDistance = 3.2;
    this.minDistance = radius + 0.012;
    this.homeRotation = new Quaternion();
    this.homeDistance = 3.2;
    this.viewport = { width: 1, height: 1 };
    this.angularVelocity = new Vector3();
    this.autoRotate = !reducedMotion;
    this.autoRotateSpeed = 0.12; // rad/s
    this.autoRotateDelay = 2.5; // s after the last interaction
    this.reducedMotion = reducedMotion;
    this.idleFor = 0;
    this.autoRotateAmount = 0;
    this.enabled = true;
    this._anim = null;
    this._dragging = false;
    this._lastDrag = { dx: 0, dy: 0, dt: 0 };
  }

  setViewport(width, height) {
    this.viewport.width = Math.max(1, width);
    this.viewport.height = Math.max(1, height);
  }

  // Updates the reset distance; if the user has not zoomed, follow it.
  setHomeDistance(d) {
    const untouched = Math.abs(this.targetDistance - this.homeDistance) < 1e-6;
    this.homeDistance = Math.max(this.minDistance, d);
    if (untouched) this.distance = this.targetDistance = this.homeDistance;
  }

  // Radians per pixel: full-height drag = one turn when far, gentler up close.
  get radPerPixel() {
    const gap = this.distance - this.radius;
    const scale = Math.min(1, gap / (1.5 * this.radius));
    return ((Math.PI * 2) / this.viewport.height) * Math.max(0.002, scale);
  }

  poke() {
    this.idleFor = 0;
    this.autoRotateAmount = 0;
    if (this._anim) this._anim = null;
  }

  beginDrag() {
    this.poke();
    this._dragging = true;
    this.angularVelocity.set(0, 0, 0);
  }

  // Screen-space drag in CSS pixels.
  rotateBy(dx, dy, dt = 1 / 60) {
    if (!this.enabled) return;
    const k = this.radPerPixel;
    const ax = dy * k;
    const ay = dx * k;
    _dq.setFromAxisAngle(_axisX, ax);
    this.rotation.premultiply(_dq);
    _dq.setFromAxisAngle(_axisY, ay);
    this.rotation.premultiply(_dq);
    this.rotation.normalize();
    if (dt > 0) {
      const inv = 1 / Math.max(dt, 1 / 240);
      this.angularVelocity
        .set(ax * inv, ay * inv, 0)
        .multiplyScalar(0.5)
        .add(this.angularVelocity.clone().multiplyScalar(0.5));
    }
    this.poke();
  }

  rollBy(angle) {
    if (!this.enabled) return;
    _dq.setFromAxisAngle(_axisZ, angle);
    this.rotation.premultiply(_dq).normalize();
    this.poke();
  }

  endDrag() {
    this._dragging = false;
    this.idleFor = 0;
  }

  // Multiplies the gap between camera and surface. factor < 1 zooms in.
  zoomBy(factor) {
    if (!this.enabled) return;
    const gap = Math.max(this.targetDistance - this.radius, this.minDistance - this.radius);
    this.targetDistance = Math.max(this.minDistance, this.radius + gap * factor);
    this.poke();
  }

  reset(animated = true) {
    this.poke();
    this.angularVelocity.set(0, 0, 0);
    if (!animated || this.reducedMotion) {
      this.rotation.copy(this.homeRotation);
      this.distance = this.targetDistance = this.homeDistance;
      return;
    }
    this._anim = {
      t: 0,
      duration: 0.6,
      fromQ: this.rotation.clone(),
      fromD: this.distance,
    };
    this.targetDistance = this.homeDistance;
  }

  getState() {
    const q = this.rotation;
    return {
      rotation: [q.x, q.y, q.z, q.w].map((v) => Math.round(v * 1e5) / 1e5),
      distance: Math.round(this.distance * 1e4) / 1e4,
    };
  }

  setState(state, asHome = false) {
    if (state && Array.isArray(state.rotation)) this.rotation.fromArray(state.rotation).normalize();
    if (state && Number.isFinite(state.distance)) {
      this.distance = this.targetDistance = Math.max(this.minDistance, state.distance);
    }
    if (asHome) {
      this.homeRotation.copy(this.rotation);
      this.homeDistance = this.distance;
    }
    this._anim = null;
    this.angularVelocity.set(0, 0, 0);
  }

  update(dt) {
    dt = Math.min(0.1, Math.max(0, dt));
    if (this._anim) {
      const a = this._anim;
      a.t += dt;
      const t = Math.min(1, a.t / a.duration);
      const e = 1 - Math.pow(1 - t, 3);
      this.rotation.copy(a.fromQ).slerp(this.homeRotation, e);
      this.distance = a.fromD + (this.homeDistance - a.fromD) * e;
      if (t >= 1) this._anim = null;
      return;
    }
    // Damped zoom.
    const zk = 1 - Math.exp(-dt / 0.08);
    this.distance += (this.targetDistance - this.distance) * zk;
    if (Math.abs(this.targetDistance - this.distance) < 1e-5) this.distance = this.targetDistance;
    // Short coast after a drag, then stop.
    if (!this._dragging && this.angularVelocity.lengthSq() > 1e-8) {
      const v = this.angularVelocity;
      _dq.setFromAxisAngle(_axisX, v.x * dt);
      this.rotation.premultiply(_dq);
      _dq.setFromAxisAngle(_axisY, v.y * dt);
      this.rotation.premultiply(_dq).normalize();
      v.multiplyScalar(Math.exp(-dt / 0.14));
      if (v.lengthSq() < 1e-6) v.set(0, 0, 0);
    }
    // Idle auto-rotate.
    if (!this._dragging) this.idleFor += dt;
    if (
      this.autoRotate &&
      !this.reducedMotion &&
      !this._dragging &&
      this.idleFor > this.autoRotateDelay
    ) {
      this.autoRotateAmount = Math.min(1, this.autoRotateAmount + dt / 2);
      const e = this.autoRotateAmount * this.autoRotateAmount;
      _dq.setFromAxisAngle(_axisY, this.autoRotateSpeed * e * dt);
      this.rotation.premultiply(_dq).normalize();
    }
  }
}

// Turns pointer/wheel events into gestures. The host decides whether a
// single-pointer drag paints or orbits through `classify(event)`.
export class GestureRecognizer {
  constructor(element, handlers) {
    this.el = element;
    this.h = handlers;
    this.pointers = new Map();
    this.gesture = null; // 'paint' | 'orbit' | 'pinch'
    this.primaryId = null;
    this.lastTap = { time: -1e9, x: 0, y: 0 };
    this.moved = 0;
    this._pinch = null;
    this._bind();
  }

  _bind() {
    const el = this.el;
    this._onDown = (e) => this.onPointerDown(e);
    this._onMove = (e) => this.onPointerMove(e);
    this._onUp = (e) => this.onPointerUp(e);
    this._onWheel = (e) => {
      e.preventDefault();
      this.h.onWheel?.(e);
    };
    el.addEventListener("pointerdown", this._onDown);
    el.addEventListener("pointermove", this._onMove);
    el.addEventListener("pointerup", this._onUp);
    el.addEventListener("pointercancel", this._onUp);
    el.addEventListener("lostpointercapture", this._onUp);
    el.addEventListener("wheel", this._onWheel, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("dblclick", (e) => e.preventDefault());
  }

  dispose() {
    const el = this.el;
    el.removeEventListener("pointerdown", this._onDown);
    el.removeEventListener("pointermove", this._onMove);
    el.removeEventListener("pointerup", this._onUp);
    el.removeEventListener("pointercancel", this._onUp);
    el.removeEventListener("lostpointercapture", this._onUp);
    el.removeEventListener("wheel", this._onWheel);
  }

  onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button > 2) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      type: e.pointerType,
    });
    this.h.onInteract?.(e);
    if (this.pointers.size === 1) {
      this.primaryId = e.pointerId;
      this.moved = 0;
      const now = e.timeStamp;
      const lt = this.lastTap;
      const isDouble = now - lt.time < 350 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 24;
      this.lastTap = { time: now, x: e.clientX, y: e.clientY };
      const kind = this.h.classify ? this.h.classify(e) : "orbit";
      if (isDouble && kind === "orbit") {
        this.lastTap.time = -1e9;
        this.gesture = "orbit";
        this.h.onDoubleTap?.(e);
        return;
      }
      this.gesture = kind;
      if (kind === "paint") this.h.onPaintStart?.(e);
      else this.h.onOrbitStart?.(e);
    } else if (this.pointers.size === 2) {
      if (this.gesture === "paint") this.h.onPaintEnd?.(e, true);
      else if (this.gesture === "orbit") this.h.onOrbitEnd?.(e);
      this.gesture = "pinch";
      this._pinch = this._pinchState();
      this.h.onPinchStart?.();
    }
  }

  _pinchState() {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      ang: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  onPointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      this.h.onHover?.(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dt = Math.max(1, e.timeStamp - p.t) / 1000;
    this.moved += Math.hypot(dx, dy);
    if (this.gesture === "paint" && e.pointerId === this.primaryId) {
      const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
      this.h.onPaintMove?.(e, events && events.length ? events : [e]);
    } else if (this.gesture === "orbit" && e.pointerId === this.primaryId) {
      this.h.onOrbit?.(dx, dy, dt, e);
    } else if (this.gesture === "pinch" && this.pointers.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      p.t = e.timeStamp;
      const s = this._pinchState();
      const prev = this._pinch;
      let dAng = s.ang - prev.ang;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      this.h.onPinch?.({
        scale: prev.dist > 0 ? s.dist / prev.dist : 1,
        dx: s.cx - prev.cx,
        dy: s.cy - prev.cy,
        twist: dAng,
        dt,
      });
      this._pinch = s;
      return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = e.timeStamp;
  }

  onPointerUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.gesture === "paint" && e.pointerId === this.primaryId) {
      this.h.onPaintEnd?.(e, false);
      this.gesture = null;
    } else if (this.gesture === "orbit" && e.pointerId === this.primaryId) {
      this.h.onOrbitEnd?.(e);
      this.gesture = null;
    } else if (this.gesture === "pinch") {
      if (this.pointers.size < 2) {
        this.h.onPinchEnd?.();
        if (this.pointers.size === 1) {
          this.primaryId = [...this.pointers.keys()][0];
          this.gesture = "orbit";
          this.h.onOrbitStart?.(e);
        } else {
          this.gesture = null;
        }
      }
    }
    if (this.pointers.size === 0) {
      this.gesture = null;
      this.primaryId = null;
      if (this.moved > 12) this.lastTap.time = -1e9;
    }
  }
}

export function quaternionToArray(q) {
  return [q.x, q.y, q.z, q.w];
}
