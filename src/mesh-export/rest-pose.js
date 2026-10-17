// Bake supported default kit poses without loading the renderer. Dynamic
// surfaces that cannot be reproduced here fail instead of exporting their rig.
import { quatAxisAngle, quatMul, quatRotate, vec } from "../kit.js";
import { KINDS, MORPH_RANGE } from "../kit-tables.js";

const ID = [0, 0, 0, 1],
  ZERO = [0, 0, 0];
const knownKinds = new Set(Object.values(KINDS));
const dynamicKinds = new Set([
  KINDS.flame,
  KINDS.rise,
  KINDS.fall,
  KINDS.screen,
  KINDS.relief,
  KINDS.leaf,
  KINDS.volume,
]);
const unsupported = (reason) => {
  throw new Error(
    `This toy's ${reason} cannot be baked into a mesh here. Save its splats from the toy, then open that file here.`,
  );
};
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rotation = (pose, axis = [0, 1, 0]) => {
  const q = pose?.quat || (pose?.angle ? quatAxisAngle(pose.axis || axis, pose.angle) : ID);
  const length = Math.hypot(...q);
  if (!Number.isFinite(length) || !length) unsupported("invalid rotation");
  return q.map((v) => v / length);
};
const active = (values) =>
  values?.some((v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? active(v) : !!v));

export function bakeRestPose(ctx, controlOverrides = {}) {
  const { buf, recipe = {} } = ctx;
  // Match buildKit's frame: fitted toys rotate about zero, and their radius
  // is the largest absolute extent, including declared animation reaches.
  const bounds =
    recipe.frameReaches && ctx.reaches?.length
      ? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      : buf.bounds();
  for (const reach of ctx.reaches || [])
    for (let k = 0; k < 3; k++) {
      bounds.min[k] = Math.min(bounds.min[k], reach[k]);
      bounds.max[k] = Math.max(bounds.max[k], reach[k]);
    }
  const radius = Math.max(...bounds.min.map(Math.abs), ...bounds.max.map(Math.abs));
  const controls = Object.fromEntries(
    (recipe.controls || []).map((c) => [c.key, controlOverrides[c.key] ?? c.default ?? 0]),
  );
  const out = {
    energy: 0,
    grow: 1,
    amount: 1,
    glow: [1, 1, 1, 0],
    parts: {},
    body: null,
    fx: {},
    addon: null,
    tokens: null,
    cues: [],
    morph: null,
    levers: null,
  };
  try {
    const result = recipe.drive?.(0, controls, out, {
      time: 0,
      R: radius,
      tap: null,
      taps: [],
      data: ctx.kit?.data,
      sound: { enabled: false },
      view: 0,
      slider: null,
      zoom: { log: 0, n: 0, resets: 0 },
      figures: [],
    });
    if (result?.then) unsupported("asynchronous pose");
  } catch (error) {
    unsupported(`default pose (${error.message || error})`);
  }
  if (out.body?.squash) unsupported("body squash");
  if (out.addon || Object.values(out.fx || {}).some((v) => v != null && v !== false && v !== 0))
    unsupported("additional geometry or deformation");
  const fit = ctx.transform?.scale ?? 1,
    center = ctx.transform?.center || ZERO,
    bodyQ = rotation(out.body),
    bodyOffset = vec.mul(out.body?.offset || ZERO, radius);
  const parts = (ctx.parts || []).map((def) => {
    const pose = out.parts?.[def.name] || {};
    if (pose.cull) unsupported("view-dependent part visibility");
    return {
      q: rotation(pose, def.axis),
      pivot: def.pivot || ZERO,
      offset: vec.mul(pose.offset || ZERO, fit),
      scale: pose.scale ?? 1,
      visible: pose.visible ?? 1,
    };
  });
  const tokens = (out.tokens || []).map((pose) => {
    if (!pose) return null;
    return {
      q: rotation(pose),
      pivot: pose.base ? vec.mul(vec.sub(pose.base, center), fit) : ZERO,
      offset: vec.mul(pose.offset || ZERO, fit),
      visible: pose.visible ?? 1,
    };
  });
  const movingTokens = tokens.some(
    (t) =>
      t && (t.visible !== 1 || t.offset.some((v) => v !== 0) || t.q.some((v, k) => v !== ID[k])),
  );
  let count = 0;
  for (let i = 0; i < buf.count; i++) {
    const j = i * 3,
      k = i * 4,
      kind = Math.round(buf.anim?.[k + 1] || 0),
      a = buf.anim?.[k + 2] || 0,
      b = buf.anim?.[k + 3] || 0,
      part = parts[Math.round(buf.anim?.[k] || 0) & 15],
      token = kind === KINDS.token ? tokens[Math.max(0, Math.min(47, Math.round(a)))] : null;
    if (buf.color[k + 3] <= 0 || part?.visible <= 0 || token?.visible <= 0 || part?.scale <= 0)
      continue;
    let p = Array.from(buf.pos.subarray(j, j + 3)),
      q = Array.from(buf.rot.subarray(k, k + 4)),
      scale = 1,
      alpha = buf.color[k + 3];
    const amount = out.amount ?? 1;
    if (
      dynamicKinds.has(kind) ||
      (kind === KINDS.beat && amount * a !== 0) ||
      (kind === KINDS.breathe && Math.abs(amount * a * Math.sin(b)) > 1e-12) ||
      (kind === KINDS.sway && amount * a !== 0 && p[1] > b) ||
      (kind === KINDS.wave && amount * a !== 0) ||
      (kind === KINDS.melt && out.energy * a !== 0) ||
      ([KINDS.skin, KINDS.skin4].includes(kind) && movingTokens) ||
      (kind === KINDS.lever && active(out.levers)) ||
      (kind === KINDS.key && out.press >= 0 && Math.floor(out.press) === Math.round(a)) ||
      !knownKinds.has(kind)
    )
      unsupported("active surface deformation");
    if (kind === KINDS.grow) scale *= smoothstep(a, a + 0.08, out.grow ?? 1);
    if (kind === KINDS.morph) {
      const channel = Math.floor(b / 4096),
        value = out.morph?.[channel % 4] ?? 0;
      const dx = Math.floor(a / 4096),
        dy = a - dx * 4096,
        dz = b - channel * 4096;
      p = vec.add(p, vec.mul([dx - 2048, dy - 2048, dz - 2048], (value * MORPH_RANGE) / 2048));
      if (channel >= 4) scale *= 1 - 0.6 * value;
    }
    if (kind === KINDS.fade) {
      const width = Math.abs(b),
        channel = Math.floor(width),
        fade = smoothstep(a, a + Math.max(width - channel, 0.005), out.morph?.[channel] ?? 0);
      alpha *= b < 0 ? fade : 1 - fade;
    }
    if (token) {
      p = vec.add(vec.add(token.pivot, quatRotate(token.q, vec.sub(p, token.pivot))), token.offset);
      q = quatMul(token.q, q);
      scale *= token.visible;
    }
    // Part zero is the shader's untransformed root; whole-toy motion is body.
    if ((Math.round(buf.anim?.[k] || 0) & 15) > 0 && part) {
      p = vec.add(
        vec.add(part.pivot, quatRotate(part.q, vec.mul(vec.sub(p, part.pivot), part.scale))),
        part.offset,
      );
      q = quatMul(part.q, q);
      scale *= part.scale * part.visible;
    }
    if (!(scale > 0 && alpha > 0)) continue;
    p = vec.add(quatRotate(bodyQ, p), bodyOffset);
    q = quatMul(bodyQ, q);
    const sizes = Array.from(buf.scale.subarray(j, j + 3), (v) => v * scale);
    if (![...p, ...q, ...sizes, alpha].every(Number.isFinite)) unsupported("invalid default pose");
    buf.pos.set(p, count * 3);
    buf.scale.set(sizes, count * 3);
    buf.rot.set(q, count * 4);
    buf.color.set([buf.color[k], buf.color[k + 1], buf.color[k + 2], alpha], count * 4);
    if (buf.anim) buf.anim.copyWithin(count * 4, k, k + 4);
    count++;
  }
  buf.count = count;
  return buf;
}
