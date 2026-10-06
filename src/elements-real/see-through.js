// Real elements (lane Elements): finds where the background shows through a lifted sample, from
// two renders of the same frame, one with the sample and one without (tools/rel-side.mjs and
// tests/rel.spec.mjs). The pixels that differ are the sample's silhouette; it is closed by a few
// pixels (so its own ragged outline doesn't count) and filled; unchanged pixels inside the closed,
// filled silhouette are see-through. Returns the counts and a still of the sample (see-through
// pixels in magenta).

// The side views the check looks from: [name, the spin control's value]. The spin pulse runs from
// 1 to 0, and the turn (turnPath in src/packs/real-elements.js) holds a quarter turn while 1 - spin
// is between 0.18 and 0.36 and three quarters between 0.64 and 0.82; the others are 10 degrees to
// either side of those, on the way in and out.
// Up close, from the angles the owner looked from (October 6, 2026): [name, spin, the camera's
// yaw, pitch and distance (in toy radii), and its pan to the lifted sample]. The filler columns
// the side wall used to be made of only showed their gaps this close.
export const CLOSE_VIEWS = [
  ["close-a", 0.73, 0.5, 0.25],
  ["close-b", 0.73, -0.6, -0.1],
  ["close-c", 0.27, 0.9, 0.4],
  ["close-d", 0.27, -0.3, 0.6],
  ["close-e", 1, -1.2, 0.3],
].map(([name, spin, yaw, pitch]) => [name, spin, { yaw, pitch, distance: 1.1, pan: [0.4, 0.03, 0.35] }]); // prettier-ignore

export const SIDE_VIEWS = [
  ["80", 0.8663],
  ["90", 0.73],
  ["100", 0.5849],
  ["260", 0.4151],
  ["270", 0.27],
  ["280", 0.1337],
];

const differs = (a, b, i, tol) =>
  Math.abs(a[i] - b[i]) > tol || Math.abs(a[i + 1] - b[i + 1]) > tol || Math.abs(a[i + 2] - b[i + 2]) > tol; // prettier-ignore

function dilate(m, w, h, r, val) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1 - val;
      for (let dy = -r; dy <= r && v !== val; dy++)
        for (let dx = -r; dx <= r && v !== val; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (m[yy * w + xx] === val) v = val;
        }
      out[y * w + x] = v;
    }
  return out;
}

export function seeThrough(withS, without, { tol = 2, close = 4 } = {}) {
  const { width: w, height: h } = withS;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = differs(withS.data, without.data, i * 4, tol) ? 1 : 0;
  // The sample is the biggest changed region: keep the box round it (the home tile changes too).
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  // (Take the bounding box of the densest change: rows and columns with many changed pixels.)
  const rowN = new Int32Array(h);
  const colN = new Int32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) (rowN[y]++, colN[x]++);
  const maxR = Math.max(...rowN);
  const maxC = Math.max(...colN);
  for (let y = 0; y < h; y++)
    if (rowN[y] > maxR * 0.08) ((y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)));
  for (let x = 0; x < w; x++)
    if (colN[x] > maxC * 0.08) ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)));
  if (x1 < 0) return { silhouette: 0, holes: 0, ratio: 0, still: withS };
  const pad = 6;
  [x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(w - 1, x1 + pad), Math.min(h - 1, y1 + pad)]; // prettier-ignore
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const sub = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) sub[y * bw + x] = m[(y + y0) * w + x + x0];
  const closed = dilate(dilate(sub, bw, bh, close, 1), bw, bh, close, 0);
  // Background the silhouette encloses (a hole too wide for the closing): unchanged pixels that
  // can't be reached from the box's border through unchanged pixels.
  const outside = new Uint8Array(bw * bh);
  const stack = [];
  for (let x = 0; x < bw; x++) stack.push(x, (bh - 1) * bw + x);
  for (let y = 0; y < bh; y++) stack.push(y * bw, y * bw + bw - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || sub[i]) continue;
    outside[i] = 1;
    const x = i % bw;
    if (x > 0) stack.push(i - 1);
    if (x < bw - 1) stack.push(i + 1);
    if (i >= bw) stack.push(i - bw);
    if (i < bw * (bh - 1)) stack.push(i + bw);
  }
  for (let i = 0; i < bw * bh; i++) if (!outside[i]) closed[i] = 1;
  let silhouette = 0;
  let holes = 0;
  const still = { width: bw, height: bh, data: new Uint8Array(bw * bh * 4) };
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      const j = ((y + y0) * w + x + x0) * 4;
      still.data.set(withS.data.subarray(j, j + 4), i * 4);
      if (closed[i]) silhouette++;
      if (closed[i] && !sub[i]) {
        holes++;
        still.data.set([255, 0, 255, 255], i * 4);
      }
    }
  return { silhouette, holes, ratio: holes / (silhouette || 1), still };
}
