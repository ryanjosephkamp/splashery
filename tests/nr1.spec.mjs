// Lane NR1: the Neuron specimen finished to the bar. The lit slide is part of the merge tree and
// still conserves mass, center, and covariance; the stains read as histology; focus defocuses
// like a microscope with the slide still lit; a tap stimulates the cell where it lands; and the
// new toy takes no related card from any other toy's page.
import { test, expect } from "@playwright/test";
import { TOYS } from "../src/toys.js";
import { relatedToys } from "../tools/site-toy-pages.mjs";
import {
  growNeuron,
  buildFocusTree,
  gaussianMoments,
  stainLook,
  packTap,
  STAINS,
} from "../src/packs/neuron.js";

const M = { cyto: 0, nissl: 1, myelin: 2, nucleus: 4, nucleolus: 5, glia: 6, dendrite: 7, axon: 8 };
const LIT = 10,
  CLEAR = 11;
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const blueness = (c) => c[2] - c[0];
const isSlide = (s) => s.k[LIT] + s.k[CLEAR] > 0;

test("the lit slide is part of the tree, and every level still conserves the moments", () => {
  for (const [depth, slide] of [
    [13, 512],
    [15, 2048],
  ]) {
    const cell = growNeuron(1952, depth);
    const field = cell.leaves.filter(isSlide);
    expect(field).toHaveLength(slide);
    // The slide neither fires nor takes a dye, and it lies behind the cell.
    expect(field.every((s) => s.gain === 0 && s.k[LIT] + s.k[CLEAR] === 1)).toBe(true);
    const cellLeaves = cell.leaves.filter((s) => !isSlide(s));
    expect(Math.max(...field.map((s) => s.m[2]))).toBeLessThan(
      Math.min(...cellLeaves.map((s) => s.m[2])),
    );
    const tree = buildFocusTree(cell.leaves);
    const finest = gaussianMoments(cell.leaves);
    for (let level = 0; level <= depth; level++) {
      const m = gaussianMoments(tree.nodes.slice(2 ** level, 2 ** (level + 1)));
      const drift = Math.max(
        Math.abs(m.w - finest.w),
        ...m.m.map((x, i) => Math.abs(x - finest.m[i])),
        ...m.S.map((x, i) => Math.abs(x - finest.S[i])),
      );
      expect(drift, `depth ${depth}, level ${level}`).toBeLessThan(1e-12);
    }
    let shares = 0;
    for (let i = 1; i < tree.nodes.length; i++) {
      const k = tree.nodes[i].k;
      if (k.length !== 12 || Math.abs(k.reduce((a, b) => a + b, 0) - 1) > 1e-12) shares++;
    }
    expect(shares, "nodes whose twelve material shares do not sum to one").toBe(0);
  }
});

test("each stain dyes the parts the way it dyes tissue", () => {
  const color = (stain, name) =>
    stainLook(
      { k: Array.from({ length: 12 }, (_, j) => (j === M[name] ? 1 : 0)), w: 1, S: [1, 1, 1, 0, 0, 0] }, // prettier-ignore
      STAINS[stain],
    ).color;
  // Nissl (cresyl violet): dark Nissl bodies and nucleolus, a pale nucleus, and a pale axon and
  // myelin, which take almost no dye.
  expect(lum(color("nissl", "nissl"))).toBeLessThan(lum(color("nissl", "cyto")) - 0.1);
  expect(lum(color("nissl", "nucleolus"))).toBeLessThan(lum(color("nissl", "cyto")) - 0.1);
  expect(lum(color("nissl", "nucleus"))).toBeGreaterThan(lum(color("nissl", "cyto")) + 0.1);
  expect(lum(color("nissl", "axon"))).toBeGreaterThan(lum(color("nissl", "cyto")) + 0.1);
  expect(lum(color("nissl", "myelin"))).toBeGreaterThan(lum(color("nissl", "cyto")) + 0.1);
  // Golgi: the whole neuron black, the field amber, and myelin unstained.
  for (const part of ["cyto", "nucleus", "dendrite"])
    expect(lum(color("golgi", part)), part).toBeLessThan(0.12);
  expect(STAINS.golgi.field[0] - STAINS.golgi.field[2]).toBeGreaterThan(0.3);
  expect(lum(color("golgi", "myelin"))).toBeGreaterThan(0.5);
  // H&E: blue-purple nuclei (hematoxylin) against pink cytoplasm (eosin).
  expect(blueness(color("he", "nucleolus"))).toBeGreaterThan(blueness(color("he", "cyto")) + 0.3);
  expect(blueness(color("he", "glia"))).toBeGreaterThan(blueness(color("he", "cyto")) + 0.3);
  expect(color("he", "cyto")[0]).toBeGreaterThan(color("he", "cyto")[1] + 0.2);
});

test("the slide's lamp is drawn once, by its finest splats", () => {
  const depth = 13;
  const cell = growNeuron(1952, depth);
  const tree = buildFocusTree(cell.leaves);
  const stain = STAINS.nissl;
  const level = (l) => tree.nodes.slice(2 ** l, 2 ** (l + 1));
  // Coarse nodes that are only slide draw nothing: the finest slide splats stay on as the lamp.
  for (let l = 0; l < depth; l++)
    for (const s of level(l).filter((s) => s.k[LIT] + s.k[CLEAR] > 1 - 1e-12))
      expect(stainLook(s, stain, false).opacity).toBe(0);
  // The slide's finest splats are opaque inside its rim.
  const lamp = level(depth).filter((s) => s.k[LIT] === 1);
  expect(lamp.length).toBeGreaterThan(200);
  expect(Math.min(...lamp.map((s) => stainLook(s, stain).opacity))).toBeCloseTo(1, 12);
});

test("a tap's point packs into two morph channels and back", () => {
  for (const p of [
    [-0.547, 0.116, 0.005],
    [0.9, -0.3, -0.21],
    [-1.999, 1.5, 1.999],
  ]) {
    const [xz, y] = packTap(p);
    expect(Number.isInteger(xz) && xz < 2 ** 24).toBe(true);
    const qz = Math.floor(xz / 4096);
    expect((xz - 4096 * qz) / 1000 - 2).toBeCloseTo(p[0], 3);
    expect(qz / 1000 - 2).toBeCloseTo(p[2], 3);
    expect(y).toBe(p[1]);
  }
  // The Play button has no point: no stimulus anywhere on the slide.
  expect(packTap(null)[1]).toBeGreaterThan(50);
});

test("the specimen takes no related card from any other toy's page", () => {
  const i = TOYS.findIndex((t) => t.id === "specimen-neuron");
  const toy = TOYS[i];
  const withIt = new Map(TOYS.map((t) => [t.id, relatedToys(t).map((o) => o.id)]));
  TOYS.splice(i, 1);
  try {
    for (const t of TOYS) {
      const lost = relatedToys(t)
        .map((o) => o.id)
        .filter((id) => !withIt.get(t.id).includes(id));
      expect(lost, `${t.id} lost a related card`).toEqual([]);
    }
  } finally {
    TOYS.splice(i, 0, toy);
  }
  expect(withIt.get("neuron")).toContain("bacterium");
});

for (const [width, height, profile, depth] of [
  [390, 844, "low", 13],
  [1440, 900, "high", 15],
]) {
  test(`a tap stimulates where it lands, and the slide stays lit out of focus at ${width}×${height}`, async ({
    page,
  }) => {
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(m.text());
    });
    await page.setViewportSize({ width, height });
    await page.goto(`/?labs=1&renderer=webgl2&adapt=off&profile=${profile}`);
    await page.waitForSelector("body[data-ready='true']");
    // Two dendrites: one up and to the left of the cell body, one below it.
    const cell = growNeuron(1952, depth);
    const nearest = (dx, dy) =>
      cell.leaves
        .filter((s) => s.k[M.dendrite] === 1)
        .reduce((a, s) =>
          Math.hypot(s.m[0] - cell.soma[0] - dx, s.m[1] - cell.soma[1] - dy) <
          Math.hypot(a.m[0] - cell.soma[0] - dx, a.m[1] - cell.soma[1] - dy)
            ? s
            : a,
        ).m;
    const upLeft = nearest(-0.3, 0.14),
      below = nearest(0.04, -0.2);
    const result = await page.evaluate(
      async ({ upLeft, below }) => {
        const { app, player } = window.__splashery;
        await app.chooseToy("specimen-neuron");
        app.setLook({ background: "#111111" });
        player.camera.setTurntable(false);
        player.idle.weight = 0;
        player.opts.idleDelay = 1e9;
        const stage = player.stage;
        const handlers = stage.updateHandlers.slice();
        let tick = 0;
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(() => {
          for (const h of handlers) h(tick);
          tick = 0;
        });
        const grab = async () => {
          for (let i = 0; i < 3; i++) {
            player.camera.cur = { ...player.camera.home };
            player.camera.tgt = { ...player.camera.home };
            await stage.captureFrame();
          }
          const c = await stage.captureFrame();
          return { w: c.width, h: c.height, px: c.getContext("2d").getImageData(0, 0, c.width, c.height).data }; // prettier-ignore
        };
        const tf = player.motion.ctx.transform;
        const toWorld = (p) => p.map((v, i) => (v - tf.center[i]) * tf.scale);
        const home = await grab();
        // Where the frame changed after a tap: the centroid of the changed pixels.
        const changed = async (point) => {
          player.act(toWorld(point));
          tick = 0.08;
          await stage.captureFrame();
          const now = await grab();
          let n = 0,
            x = 0,
            y = 0;
          for (let i = 0; i < now.px.length; i += 4) {
            const d = Math.abs(now.px[i] - home.px[i]) + Math.abs(now.px[i + 1] - home.px[i + 1]) + Math.abs(now.px[i + 2] - home.px[i + 2]); // prettier-ignore
            if (d > 60) {
              n++;
              x += ((i / 4) % now.w) / now.w;
              y += Math.floor(i / 4 / now.w) / now.h;
            }
          }
          // Let the spike finish before the next tap.
          for (let i = 0; i < 40; i++) {
            tick = 0.1;
            await stage.captureFrame();
          }
          return { n, x: x / Math.max(n, 1), y: y / Math.max(n, 1) };
        };
        const a = await changed(upLeft);
        const b = await changed(below);
        // The slide stays lit at its center while the cell goes out of focus.
        const centerLum = async () => {
          const f = await grab();
          let sum = 0,
            n = 0;
          for (let y = Math.round(f.h * 0.3); y < f.h * 0.7; y += 4)
            for (let x = Math.round(f.w * 0.62); x < f.w * 0.72; x += 4) {
              const i = (y * f.w + x) * 4;
              sum += 0.299 * f.px[i] + 0.587 * f.px[i + 1] + 0.114 * f.px[i + 2];
              n++;
            }
          return sum / n;
        };
        // Sharpness as a microscope's autofocus measures it: the mean gradient of luminance
        // inside the slide's lit span. It falls as focus drops. It is taken on 4×4 block means:
        // CI's SwiftShader dithers about a level per pixel, which would otherwise add the same
        // floor to every focus and hide the smooth ramps of a slide far out of focus.
        const B = 4;
        const sharpness = async () => {
          const f = await grab();
          const at = (x, y) => {
            const i = (y * f.w + x) * 4;
            return 0.299 * f.px[i] + 0.587 * f.px[i + 1] + 0.114 * f.px[i + 2];
          };
          // The slide's lit span: down the middle column, then across a row in its upper part.
          // The band measured stays clear of its rim and rounded corners, which stay sharp.
          const col = Math.round(f.w / 2);
          let y0 = 0,
            y1 = f.h - 1;
          while (y0 < f.h - 1 && at(col, y0) < 150) y0++;
          while (y1 > 0 && at(col, y1) < 150) y1--;
          const row = Math.round(y0 + 0.08 * (y1 - y0));
          let x0 = 0,
            x1 = f.w - 1;
          while (x0 < f.w - 1 && at(x0, row) < 150) x0++;
          while (x1 > 0 && at(x1, row) < 150) x1--;
          const mean = (bx, by) => {
            let m = 0;
            for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) m += at(x, y);
            return m / (B * B);
          };
          let sum = 0,
            n = 0;
          const yEnd = y0 + 0.85 * (y1 - y0) - B,
            xEnd = x0 + 0.92 * (x1 - x0) - B;
          for (let y = Math.round(y0 + 0.15 * (y1 - y0)); y + B < yEnd; y += B)
            for (let x = Math.round(x0 + 0.08 * (x1 - x0)); x + B < xEnd; x += B) {
              const m = mean(x, y);
              sum += (Math.abs(mean(x + B, y) - m) + Math.abs(mean(x, y + B) - m)) / B;
              n++;
            }
          return sum / n;
        };
        const lit = [],
          sharp = [];
        for (const focus of [1, 0.55, 0.5, 0.2, 0.02]) {
          player.motion.setControl("focus", focus, { snap: true });
          lit.push(await centerLum());
          sharp.push(await sharpness());
        }
        player.motion.setControl("focus", 1, { snap: true });
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...handlers);
        return { a, b, lit, sharp };
      },
      { upLeft, below },
    );
    // Each tap lights up a place, and the two places sit where the taps landed.
    expect(result.a.n).toBeGreaterThan(20);
    expect(result.b.n).toBeGreaterThan(20);
    expect(result.a.y, JSON.stringify(result)).toBeLessThan(result.b.y - 0.03);
    expect(result.a.x, JSON.stringify(result)).toBeLessThan(result.b.x - 0.03);
    for (const l of result.lit) expect(l, JSON.stringify(result.lit)).toBeGreaterThan(170);
    // Out of focus the cell blurs: sharpness falls at each step down, as in a microscope.
    const sh = result.sharp;
    expect(sh[1], JSON.stringify(sh)).toBeLessThan(sh[0] * 0.85);
    expect(sh[3], JSON.stringify(sh)).toBeLessThan(sh[1] * 0.85);
    expect(sh[4], JSON.stringify(sh)).toBeLessThan(sh[3] * 0.85);
    // Screenshots: Golgi mid-spike.
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      await app.setToyOption("stain", "golgi");
      player.act();
      player.motion.state.fire = 1 - 1.3 / 4.6;
      for (let i = 0; i < 3; i++) await player.stage.captureFrame();
    });
    await page.screenshot({ path: `tests/screenshots/nr1-neuron-${width}x${height}.png` });
    expect(problems).toEqual([]);
  });
}
