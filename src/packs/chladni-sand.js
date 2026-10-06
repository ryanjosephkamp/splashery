// Lane Live r7: the Chladni plate's sand, live (the owner's report of
// October 5, 2026: "I want the plate to move continuously ... very
// responsive to the audio ... the sand rearranges, like immediately, or at
// least starts to move immediately").
//
// Until r7 the sand was twelve snapshots of one settle, made when the plate
// was built for one mode, and a new note meant a new plate with freshly
// scattered sand. Now every grain moves on every frame by the same rules
// that made those snapshots (studio.js settle()): it hops about, more where
// the plate swings more, and slides toward the plate's still lines. The
// plate's swing is a live mix of its modes, each as strong as the sound
// drives it, so when the note changes the sand sets off for the new figure
// at once, from where it lies; a held note settles it into a crisp figure;
// silence leaves it where it is.
//
// The mix: modes ringing at different frequencies don't share their still
// lines; over many cycles a grain feels each mode's swing squared, weighted
// by that mode's strength squared (E = Σ aₘ² wₘ²). A grain slides down E
// toward its lowest places (a Newton step on the weighted modes, as settle()
// takes one on a single mode) and hops by √E. With one mode ringing this is
// exactly settle()'s rule.
//
// The grains are relief splats (src/live/relief.js's kind, a 3D offset per
// splat from the toy's screen canvas): each rests near the plate's middle
// and the canvas moves it to its place on every frame.

const TAB = 2048; // table steps across the plate
const KMAX = 4; // the largest n or m among the modes
const PI = Math.PI;
// cos(kπx) and sin(kπx) for k = 0..KMAX, x on TAB + 1 points from 0 to 1.
const COS = [];
const SIN = [];
for (let k = 0; k <= KMAX; k++) {
  const c = new Float32Array(TAB + 1);
  const s = new Float32Array(TAB + 1);
  for (let i = 0; i <= TAB; i++) {
    c[i] = Math.cos((k * PI * i) / TAB);
    s[i] = Math.sin((k * PI * i) / TAB);
  }
  COS.push(c);
  SIN.push(s);
}

export const SUBS_PER_SECOND = 40; // settle()'s small moves: 144 over its 3.6 s
const LO = 0.012;
const HI = 0.988;

export class Sand {
  // n grains, scattered evenly over the plate (0..1 each way).
  constructor(n, rand = Math.random) {
    this.n = n;
    this.X = new Float32Array(n);
    this.Y = new Float32Array(n);
    this.hop = new Float32Array(n); // how high it hops now (0..1)
    this.phase = new Float32Array(n);
    this.rand = rand;
    for (let i = 0; i < n; i++) {
      this.X[i] = 0.015 + 0.97 * rand();
      this.Y[i] = 0.015 + 0.97 * rand();
      this.phase[i] = rand() * PI * 2;
    }
    this.moving = false;
    this.steps = 0;
    // A little shaking everywhere while the plate rings (a real plate is
    // never quite still between its lines), so sand spreads along a new
    // figure's lines instead of leaving gaps where the old figure had none.
    this.floor = 0.0012;
  }

  // One frame: `dt` seconds of shaking by the modes in `drive` ([{ n, m, s,
  // a }], a the mode's strength 0..1) and of stirring (`stir` 0..1, a hand
  // sweeping the sand about). Returns whether any grain moved.
  step(dt, drive, stir = 0) {
    const rand = this.rand;
    const modes = drive.filter((d) => d.a > 1e-3);
    let A = 0;
    for (const d of modes) A += d.a * d.a;
    const shaking = A > 1e-5;
    if (!shaking && stir <= 0) {
      if (this.moving) this.hop.fill(0);
      this.moving = false;
      return false;
    }
    this.moving = true;
    this.steps++;
    // Small moves this frame: as many as settle() makes in dt, fewer when
    // the plate rings softly.
    const subs = SUBS_PER_SECOND * Math.min(0.1, dt) * Math.min(1, Math.sqrt(A) * 1.25);
    const reach = 0.02 * subs;
    const jumpScale = 0.012 * Math.sqrt(subs);
    const stirJump = stir > 0 ? 0.02 * Math.sqrt(SUBS_PER_SECOND * Math.min(0.1, dt)) * stir : 0;
    const k = modes.length;
    const wt = new Float32Array(k);
    const ns = new Int8Array(k);
    const ms = new Int8Array(k);
    const ss = new Int8Array(k);
    for (let j = 0; j < k; j++) {
      wt[j] = (modes[j].a * modes[j].a) / Math.max(1e-9, A);
      ns[j] = modes[j].n;
      ms[j] = modes[j].m;
      ss[j] = modes[j].s;
    }
    const { X, Y, hop } = this;
    for (let i = 0; i < this.n; i++) {
      let x = X[i];
      let y = Y[i];
      let E = 0;
      if (shaking) {
        const ix = Math.round(x * TAB);
        const iy = Math.round(y * TAB);
        let Gx = 0;
        let Gy = 0;
        let H = 0;
        for (let j = 0; j < k; j++) {
          const n = ns[j];
          const m = ms[j];
          const s = ss[j];
          const cnx = COS[n][ix];
          const cmx = COS[m][ix];
          const cny = COS[n][iy];
          const cmy = COS[m][iy];
          const snx = SIN[n][ix];
          const smx = SIN[m][ix];
          const sny = SIN[n][iy];
          const smy = SIN[m][iy];
          const w = cnx * cmy + s * cmx * cny;
          const gx = -n * PI * snx * cmy - s * m * PI * smx * cny;
          const gy = -m * PI * cnx * smy - s * n * PI * cmx * sny;
          const q = wt[j];
          E += q * w * w;
          Gx += q * w * gx;
          Gy += q * w * gy;
          H += q * (gx * gx + gy * gy);
        }
        // Slide toward the still lines (at most a short way)...
        let dx = (-0.045 * subs * Gx) / (H + 1e-3);
        let dy = (-0.045 * subs * Gy) / (H + 1e-3);
        const len = Math.hypot(dx, dy);
        if (len > reach) {
          dx *= reach / len;
          dy *= reach / len;
        }
        // ...and hop about, more where the plate swings more.
        const a = jumpScale * (Math.min(2, Math.sqrt(E)) ** 1.5 + this.floor / 0.012);
        const th = rand() * PI * 2;
        const r = a * (0.3 + rand());
        x += dx + r * Math.cos(th);
        y += dy + r * Math.sin(th);
      }
      if (stirJump > 0) {
        const th = rand() * PI * 2;
        const r = stirJump * (0.3 + rand());
        x += r * Math.cos(th);
        y += r * Math.sin(th);
      }
      X[i] = x < LO ? LO : x > HI ? HI : x;
      Y[i] = y < LO ? LO : y > HI ? HI : y;
      hop[i] = Math.min(1, Math.sqrt(E) / 1.4) * Math.min(1, Math.sqrt(A)) + 0.5 * stir;
    }
    return true;
  }

  // How settled the sand is on `mode`'s still lines, 0 (scattered) to 1:
  // the share of a sample of grains within 0.02 of a still line, between
  // the share for evenly scattered sand and 0.95.
  settled(mode, sample = 600) {
    const { n, m, s } = mode;
    const step = Math.max(1, Math.floor(this.n / sample));
    let near = 0;
    let count = 0;
    for (let i = 0; i < this.n; i += step) {
      const x = this.X[i];
      const y = this.Y[i];
      const w = Math.cos(n * PI * x) * Math.cos(m * PI * y) + s * Math.cos(m * PI * x) * Math.cos(n * PI * y); // prettier-ignore
      const gx = -n * PI * Math.sin(n * PI * x) * Math.cos(m * PI * y) - s * m * PI * Math.sin(m * PI * x) * Math.cos(n * PI * y); // prettier-ignore
      const gy = -m * PI * Math.cos(n * PI * x) * Math.sin(m * PI * y) - s * n * PI * Math.cos(m * PI * x) * Math.sin(n * PI * y); // prettier-ignore
      if (Math.abs(w) / Math.max(1e-6, Math.hypot(gx, gy)) < 0.02) near++;
      count++;
    }
    const share = near / Math.max(1, count);
    const scattered = 0.1; // about the share for evenly scattered sand
    return Math.max(0, Math.min(1, (share - scattered) / (0.95 - scattered)));
  }
}
