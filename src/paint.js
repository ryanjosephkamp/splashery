// Paint: a GPU pass (GSplatProcessor) recolours the splats inside a brush
// sphere by writing into a per-splat RGBA8 stream that the effect modifier
// blends over the splat colour. The stream persists until cleared, and the
// stamps are kept as data so a saved scene can replay them.

import * as pc from "./pc.js";
import { mulberry32 } from "./noise.js";
import { hexToRgb } from "./effects.js";

const PROCESS_GLSL = /* glsl */ `
uniform vec4 uBrush;      // xyz centre (toy coordinates), w radius
uniform vec4 uBrushColor; // rgb, a = opacity
void process() {
  vec3 c = getCenter();
  float d = distance(c, uBrush.xyz);
  float a = uBrushColor.a * (1.0 - smoothstep(uBrush.w * 0.6, uBrush.w, d));
  writePaintColor(vec4(uBrushColor.rgb, a));
}
`;

const PROCESS_WGSL = /* wgsl */ `
uniform uBrush: vec4f;
uniform uBrushColor: vec4f;
fn process() {
  let c = getCenter();
  let d = distance(c, uniform.uBrush.xyz);
  let a = uniform.uBrushColor.a * (1.0 - smoothstep(uniform.uBrush.w * 0.6, uniform.uBrush.w, d));
  writePaintColor(vec4f(uniform.uBrushColor.rgb, a));
}
`;

// Premultiplied "over": rgb = src * a + dst * (1 - a), alpha = a + dst * (1 - a).
const OVER = new pc.BlendState(
  true,
  pc.BLENDEQUATION_ADD,
  pc.BLENDMODE_SRC_ALPHA,
  pc.BLENDMODE_ONE_MINUS_SRC_ALPHA,
  pc.BLENDEQUATION_ADD,
  pc.BLENDMODE_ONE,
  pc.BLENDMODE_ONE_MINUS_SRC_ALPHA,
);

export class Painter {
  constructor(stage) {
    this.stage = stage;
    this.processor = null;
    this.pending = []; // scheduled stamps (drips) { at, stamp }
  }

  // Call after the toy entity exists (and has rendered once).
  attach() {
    this.detach();
    const toy = this.stage.toy;
    if (!toy) return;
    const g = toy.entity.gsplat;
    this.processor = new pc.GSplatProcessor(
      this.stage.device,
      { component: g },
      { component: g, streams: ["paintColor"] },
      { processGLSL: PROCESS_GLSL, processWGSL: PROCESS_WGSL },
    );
    this.processor.blendState = OVER;
    this.clearTexture();
  }

  detach() {
    this.processor?.destroy();
    this.processor = null;
    this.pending = [];
  }

  clearTexture() {
    const tex = this.stage.toy?.entity.gsplat.getInstanceTexture("paintColor");
    if (!tex) return;
    const data = tex.lock();
    data.fill(0);
    tex.unlock();
    this.stage.requestRender();
  }

  // stamp: [x, y, z, radius, "#rrggbb", opacity] in toy coordinates.
  apply(stamp) {
    if (!this.processor) return;
    const rgb = hexToRgb(stamp[4]);
    this.processor.setParameter("uBrush", [stamp[0], stamp[1], stamp[2], stamp[3]]);
    this.processor.setParameter("uBrushColor", [rgb[0], rgb[1], rgb[2], stamp[5]]);
    this.processor.process();
    this.stage.requestRender();
  }

  applyAll(stamps) {
    for (const s of stamps) this.apply(s);
  }

  // Runs scheduled drips whose time has come. Returns true if any remain.
  tick(time, record) {
    if (!this.pending.length) return false;
    const due = this.pending.filter((p) => p.at <= time);
    if (due.length) {
      this.pending = this.pending.filter((p) => p.at > time);
      for (const p of due) {
        this.apply(p.stamp);
        record(p.stamp);
      }
    }
    return this.pending.length > 0;
  }

  // An impact: the main stamp now, a ring of droplets, and a few drips that
  // run screen-down over the next half second. All positions in toy space.
  splash({ point, radius, color, splash, down, seed, time }) {
    const rand = mulberry32(seed);
    const out = [round(point, radius, color, 1)];
    const drops = Math.round(2 + splash * 9);
    for (let i = 0; i < drops; i++) {
      const a = rand() * Math.PI * 2;
      const r = radius * (1.3 + rand() * 2.2 * (0.5 + splash));
      const off = randomPerp(down, a, rand);
      const p = [point[0] + off[0] * r, point[1] + off[1] * r, point[2] + off[2] * r];
      out.push(round(p, radius * (0.14 + rand() * 0.3), color, 0.95));
    }
    const drips = [];
    const nd = Math.round(1 + splash * 3);
    for (let i = 0; i < nd; i++) {
      const side = (rand() - 0.5) * radius * 1.4;
      const perp = randomPerp(down, rand() * Math.PI * 2, rand);
      const len = 3 + Math.floor(rand() * 4);
      for (let k = 1; k <= len; k++) {
        const d = radius * 0.45 * k;
        const p = [
          point[0] + perp[0] * side + down[0] * d,
          point[1] + perp[1] * side + down[1] * d,
          point[2] + perp[2] * side + down[2] * d,
        ];
        drips.push({
          at: time + k * 0.07 + i * 0.05,
          stamp: round(p, radius * (0.32 - k * 0.03), color, 0.9),
        });
      }
    }
    this.pending.push(...drips);
    return out;
  }
}

function randomPerp(n, angle, rand) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let t1 = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]];
  const l = Math.hypot(...t1) || 1;
  t1 = t1.map((v) => v / l);
  const t2 = [
    n[1] * t1[2] - n[2] * t1[1],
    n[2] * t1[0] - n[0] * t1[2],
    n[0] * t1[1] - n[1] * t1[0],
  ];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const j = (rand() - 0.5) * 0.3;
  return [
    t1[0] * c + t2[0] * s + n[0] * j,
    t1[1] * c + t2[1] * s + n[1] * j,
    t1[2] * c + t2[2] * s + n[2] * j,
  ];
}

function round(p, r, color, a) {
  const q = (v) => Math.round(v * 1000) / 1000;
  return [q(p[0]), q(p[1]), q(p[2]), q(Math.max(0.002, r)), color, a];
}
