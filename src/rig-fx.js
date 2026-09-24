// Whole-body effects for scan rigs (src/rigs.js, src/rig.js): the uSpFx
// uniforms of the rig modifier (src/effects.js). Pure JavaScript.

import { rgb as hexColor } from "./kit.js";

export const FX_SLOTS = 4;

function unitAxis(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Effects for many small pieces (seeds, drupelets, crumbs, shells) that
// parts cannot cover. A rig lists up to four in `fx`; each picks splats,
// moves them and tints them, shaped by a pattern. All sizes are in world
// units, like the regions. Fields:
//   name     drive() sets out.fx[name] = { move, color, phase } each frame
//            (move: amount, in world units or radians; color: 0..1; phase:
//            where the pattern is, see below). time since the tap is added.
//   select   "all" | "key0" | "key1" | "not-key0" (colour keys, see `keys`)
//            | { part: "name" } (splats of a rig part)
//   mask     { half: normal, at } keeps splats with dot(p - origin, normal) > at
//            { stripes: axis, n } keeps n strips round the axis (half of each sector)
//            { sphere: centre, r } keeps splats within r of the centre
//            { wedge: axis, toward, angle } keeps splats within angle (radians)
//                                           of the direction toward, round the axis
//   origin   world point the effect works from (default [0, 0, 0])
//   move     { push: true }                 out from the origin
//            { along: dir }                 along a direction
//            { scatter: up, cell }          pieces (cells) fly apart, crumbs too
//            { hop: dir, cell }             pieces jump along dir (use stagger)
//            { shiver: freq }               each splat shakes
//            { turn: axis }                 turn round the axis through the origin
//            { bands: axis, width, by }     alternate bands turn opposite ways
//                                           (by: "radius" from the axis or "height")
//            { bend: axis, along }          curl: turn grows along a direction
//            { peel: axis, hinge }          strips curl outwards from the hinge height
//            { split: axis, n, spread }     the toy becomes n smaller copies round the
//                                           axis, spread apart (move: 0..1)
//   pattern  { front: width }               a shell growing from the origin (phase = radius)
//            { band: dir, width }           a band along dir (phase = position)
//            { stagger: spread, cell }      each piece bumps once as phase goes 0..1
//            { ramp: spread, cell }         each piece goes 0 -> 1 as phase goes 0..1
//            { swirl: axis, width, twist }  a wipe round the axis (phase 0..1)
//            { wave: dir, k }               sin(k * position - phase), signed
//   color    { glow: hex } | { recolor: hex, keep } (keep 0..1: keep brightness)
//            | { brighten: true } | { sparkle: fraction } | { fade: true }
//            | { darken: true }
const SELECT = { all: 1, key0: 2, key1: 3, "not-key0": 4 };
const MOVE = { push: 1, along: 2, scatter: 3, hop: 4, shiver: 5, turn: 6, bands: 7, bend: 8, peel: 9, split: 10 }; // prettier-ignore
const PATTERN = { front: 1, band: 2, stagger: 3, swirl: 4, ramp: 5, wave: 6 };
const COLOR = { glow: 1, recolor: 2, brighten: 3, sparkle: 4, fade: 5, darken: 6 };

const firstKey = (o, table) => (o ? Object.keys(o).find((k) => table[k]) : null);

// The fixed part of the fx uniforms (9 vec4 per slot).
export function fxTable(rig, parts) {
  const d = new Float32Array(FX_SLOTS * 36);
  (rig.fx || []).slice(0, FX_SLOTS).forEach((f, i) => {
    const o = i * 36;
    const set = (k, v) => d.set(v, o + k * 4);
    const origin = f.origin || [0, 0, 0];
    let select = 1;
    let partIdx = 0;
    if (typeof f.select === "string") select = SELECT[f.select] ?? 1;
    else if (f.select?.part) {
      select = 5;
      partIdx = parts.findIndex((p) => p.name === f.select.part);
    }
    let mask = 0;
    let maskV = [0, 0, 0, 0];
    if (f.mask?.half) [mask, maskV] = [1, [...unitAxis(f.mask.half), f.mask.at ?? 0]];
    else if (f.mask?.stripes) [mask, maskV] = [2, [...unitAxis(f.mask.stripes), f.mask.n ?? 4]];
    else if (f.mask?.sphere) [mask, maskV] = [3, [...f.mask.sphere, f.mask.r ?? 0.3]];
    else if (f.mask?.wedge) [mask, maskV] = [4, [...unitAxis(f.mask.wedge), 0]];
    const wedge = f.mask?.wedge ? [...unitAxis(f.mask.toward), f.mask.angle ?? 0.4] : [0, 0, 0, 0];
    const mk = firstKey(f.move, MOVE);
    const m = f.move || {};
    let moveV = [0, 1, 0, 0];
    let move2 = 0;
    let cell = 0;
    if (mk === "along" || mk === "turn") moveV = [...unitAxis(m[mk]), 0];
    else if (mk === "scatter")
      [moveV, cell] = [[0, 1, 0, m.scatter === true ? 0.3 : m.scatter], m.cell ?? 0.12]; // prettier-ignore
    else if (mk === "hop") [moveV, cell] = [[...unitAxis(m.hop), 0], m.cell ?? 0];
    else if (mk === "shiver") moveV = [0, 1, 0, m.shiver === true ? 30 : m.shiver];
    else if (mk === "bands")
      [moveV, move2] = [[...unitAxis(m.bands), m.width ?? 0.1], m.by === "height" ? 1 : 0]; // prettier-ignore
    else if (mk === "bend") [moveV, move2] = [[...unitAxis(m.bend), 0], 0];
    else if (mk === "peel") moveV = [...unitAxis(m.peel), m.hinge ?? 0];
    else if (mk === "split") [moveV, move2] = [[...unitAxis(m.split), m.n ?? 3], m.spread ?? 0.5];
    const pk = firstKey(f.pattern, PATTERN);
    const pt = f.pattern || {};
    let patW = 0.2;
    let patV = [0, 1, 0, 0];
    if (pk === "front") patW = pt.front;
    else if (pk === "band") [patV, patW] = [[...unitAxis(pt.band), 0], pt.width ?? 0.2];
    else if (pk === "stagger" || pk === "ramp") {
      patV = [0, 1, 0, pt[pk]];
      if (pt.cell) cell = pt.cell;
    } else if (pk === "swirl")
      [patV, patW] = [[...unitAxis(pt.swirl), pt.twist ?? 0], pt.width ?? 0.15]; // prettier-ignore
    else if (pk === "wave") patV = [...unitAxis(pt.wave), pt.k ?? 10];
    if (mk === "bend") patV = [...unitAxis(m.along || [1, 0, 0]), patV[3]];
    const ck = firstKey(f.color, COLOR);
    const c = f.color || {};
    let col = [1, 1, 1, 0];
    if (ck === "glow") col = [...hexColor(c.glow), 0];
    else if (ck === "recolor") col = [...hexColor(c.recolor), c.keep ?? 1];
    else if (ck === "sparkle") col = [1, 1, 1, c.sparkle === true ? 0.2 : c.sparkle];
    set(0, [select, mask, MOVE[mk] ?? 0, PATTERN[pk] ?? 0]);
    set(1, [0, 0, 0, COLOR[ck] ?? 0]);
    set(2, [...origin, patW]);
    set(3, moveV);
    set(4, patV);
    set(5, maskV);
    set(6, col);
    set(7, [0, cell, partIdx, move2]);
    set(8, wedge);
  });
  return d;
}

// Fills in this frame's amounts: out.fx[name] = { move, color, phase }.
export function fxFrame(table, rig, outFx, sinceTap) {
  (rig.fx || []).slice(0, FX_SLOTS).forEach((f, i) => {
    const o = i * 36;
    const v = outFx?.[f.name];
    table[o + 4] = v?.move ?? 0;
    table[o + 5] = v?.color ?? 0;
    table[o + 6] = v?.phase ?? 0;
    table[o + 28] = sinceTap;
  });
  return table;
}
