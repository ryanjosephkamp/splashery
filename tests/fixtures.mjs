// Tiny splat files for the tests, built in memory: a coloured ball as PLY,
// antimatter15 .splat and Niantic SPZ (version 2, gzip).
import zlib from "node:zlib";

const SH_C0 = 0.28209479177387814;

function ball(n) {
  const out = [];
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const d = [r * Math.cos(a), z, r * Math.sin(a)];
    out.push({ p: d.map((v) => v * 0.5), c: d.map((v) => 0.5 + 0.5 * v), size: 0.03 });
  }
  return out;
}

export function makePly(n = 4000) {
  const props = [
    "x",
    "y",
    "z",
    "f_dc_0",
    "f_dc_1",
    "f_dc_2",
    "opacity",
    "scale_0",
    "scale_1",
    "scale_2",
    "rot_0",
    "rot_1",
    "rot_2",
    "rot_3",
  ];
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map((p) => `property float ${p}`).join("\n")}\nend_header\n`;
  const body = Buffer.alloc(n * props.length * 4);
  ball(n).forEach((g, i) => {
    const v = [
      ...g.p,
      ...g.c.map((c) => (c - 0.5) / SH_C0),
      4,
      ...[0, 0, 0].map(() => Math.log(g.size)),
      1,
      0,
      0,
      0,
    ];
    v.forEach((x, k) => body.writeFloatLE(x, (i * props.length + k) * 4));
  });
  return Buffer.concat([Buffer.from(head), body]);
}

export function makeSplat(n = 4000) {
  const buf = Buffer.alloc(n * 32);
  ball(n).forEach((g, i) => {
    const o = i * 32;
    g.p.forEach((v, k) => buf.writeFloatLE(v, o + k * 4));
    [0, 1, 2].forEach((k) => buf.writeFloatLE(g.size, o + 12 + k * 4));
    g.c.forEach((c, k) => buf.writeUInt8(Math.round(c * 255), o + 24 + k));
    buf.writeUInt8(255, o + 27);
    buf.writeUInt8(255, o + 28);
    buf.writeUInt8(128, o + 29);
    buf.writeUInt8(128, o + 30);
    buf.writeUInt8(128, o + 31);
  });
  return buf;
}

export function makeSpz(n = 4000) {
  const frac = 12;
  const header = Buffer.alloc(16);
  header.writeUInt32LE(0x5053474e, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(n, 8);
  header.writeUInt8(0, 12);
  header.writeUInt8(frac, 13);
  const g = ball(n);
  const pos = Buffer.alloc(n * 9);
  const alpha = Buffer.alloc(n);
  const color = Buffer.alloc(n * 3);
  const scale = Buffer.alloc(n * 3);
  const rot = Buffer.alloc(n * 3);
  g.forEach((s, i) => {
    s.p.forEach((v, k) => {
      const f = Math.round(v * (1 << frac)) & 0xffffff;
      pos.writeUIntLE(f, i * 9 + k * 3, 3);
    });
    alpha[i] = 250;
    s.c.forEach(
      (c, k) =>
        (color[i * 3 + k] = Math.round(
          Math.min(255, Math.max(0, (((c - 0.5) * 0.15) / SH_C0 + 0.5) * 255)),
        )),
    );
    [0, 1, 2].forEach((k) => (scale[i * 3 + k] = Math.round((Math.log(s.size) + 10) * 16)));
    [0, 1, 2].forEach((k) => (rot[i * 3 + k] = 128));
  });
  return zlib.gzipSync(Buffer.concat([header, pos, alpha, color, scale, rot]));
}
