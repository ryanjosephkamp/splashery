// Lane Photo depth (docs/handoff/PhotoDepth.md): Photo to 3D's depth rising and settling, checked
// in the middle of the tap, not only at its ends. In the Sharp picture each piece of surface moves
// with one layer, as the splats do, and the backing sheet stays behind the surface at every moment;
// the splats' own backing too. And the tap's Sound choice.

import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { buildPhotoSplats } from "../src/packs/photo-3d-core.js";
import {
  layerMorph,
  backingOf,
  decodePhoto,
  unpackDepth,
  DEPTH_SOUNDS,
  depthSound,
} from "../src/packs/photo-3d.js";
import { toySound } from "../src/toy-sounds.js";
import { SHARP_CELLS } from "../src/packs/photo-sharp.js";
import * as H from "../src/live/relief-height.js";
import { portrait } from "./pdp-portrait.mjs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

// The surface's grid for the mid tier (as photo-sharp.js picks it) and the backing's (96 across).
function grids(s) {
  const f = Math.min(1, Math.sqrt(SHARP_CELLS.mid / (s.gx * s.gy)));
  const cols = Math.max(8, Math.round(s.gx * f));
  const rows = Math.max(8, Math.round(s.gy * f));
  const bc = 96;
  const br = Math.max(8, Math.round((bc * rows) / cols));
  return { cols, rows, bc, br };
}

// How far the surface is in front of the backing at its closest, over the tap's rise from r = 0.1
// to 0.9 (with Layers off and on): the backing at a point is at most the highest of the four
// corners of its grid cell (each triangle lies between them).
function sharpGap(s, { old = false } = {}) {
  const { cols, rows, bc, br } = grids(s);
  const bytes = H.depthBytes(s.depth);
  const field = H.backingField(bytes, s.cellBand, s.gx, s.gy, { cols: bc, rows: br, reach: 0.11, rim: 6 / rows, base: 0.5 }); // prettier-ignore
  let worst = Infinity;
  for (const layers of [0, 0.22 / 1.5])
    for (let r = 0.1; r <= 0.901; r += 0.1) {
      const morph = [0, 1, 2, 3].map((b) => layerMorph(r, b));
      const o = { morph, lift: s.stats.relief, base: 0.5, layers };
      const bz = new Float32Array((bc + 1) * (br + 1));
      for (let k = 0; k < bz.length; k++) {
        const m = field.subarray(k * 4, k * 4 + 4);
        if (!old) bz[k] = H.backingHeight(m, o);
        else {
          // (before: the farthest depth near it, on the farthest layer's channel)
          const d = Math.min(...m) / 255;
          bz[k] = (1 - morph[0]) * (o.lift * (d - 0.5) - 0.012) + morph[0] * -0.01 - 1.5 * layers;
        }
      }
      for (let j = 0; j <= rows; j += 2)
        for (let i = 0; i <= cols; i += 2) {
          const u = i / cols;
          const v = j / rows;
          const bu = ((u - 0.5) / 0.96 + 0.5) * bc;
          const bv = ((v - 0.5) / 0.96 + 0.5) * br;
          if (bu < 0 || bv < 0 || bu > bc || bv > br) continue;
          const x = Math.min(bc - 1, Math.floor(bu));
          const y = Math.min(br - 1, Math.floor(bv));
          const at = (x, y) => bz[y * (bc + 1) + x];
          const b = Math.max(at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1));
          const z = H.surfacePoint(bytes, s.cellBand, s.gx, s.gy, u, v, { cols, rows, aspect: s.aspect, ...o }); // prettier-ignore
          worst = Math.min(worst, z - b);
        }
    }
  return worst;
}

// The same for the splats: each backing splat against the surface splats over it.
function splatGap(s) {
  const back = backingOf(s, 56);
  let worst = Infinity;
  for (let r = 0.05; r <= 0.951; r += 0.05) {
    const m = [0, 1, 2, 3].map((b) => layerMorph(r, b));
    for (let k = 0; k < back.n; k += 2) {
      const bx = back.pos[k * 3];
      const by = back.pos[k * 3 + 1];
      const c = back.channel[k];
      const bz = (1 - m[c]) * back.pos[k * 3 + 2] + m[c] * -0.01;
      for (let i = 0; i < s.n; i += 5) {
        if (Math.abs(s.relief[i * 3] - bx) > back.size * 2) continue;
        if (Math.abs(s.relief[i * 3 + 1] - by) > back.size * 2) continue;
        const b = s.band[i];
        const z = (1 - m[b]) * s.relief[i * 3 + 2] + m[b] * s.flat[i * 3 + 2];
        worst = Math.min(worst, z - bz);
      }
    }
  }
  return worst;
}

const COUNT = 200000;

test.describe("the heights, in the middle of the tap", () => {
  test.setTimeout(240_000);

  test("a synthetic portrait: the backing stays behind the face at every moment", () => {
    const { photo, depth } = portrait();
    for (const d of [0.2, 0.5, 1]) {
      const s = buildPhotoSplats(photo, depth, { count: COUNT, depth: d });
      expect(sharpGap(s)).toBeGreaterThanOrEqual(0.01 - 1e-6);
      expect(splatGap(s)).toBeGreaterThan(0);
      // (the backing as it was came out in front of the face halfway through)
      if (d === 0.5) expect(sharpGap(s, { old: true })).toBeLessThan(0);
    }
  });

  test("a staircase (Palace staircase): the same", async () => {
    const dir = new URL("../assets/toys/photo-3d/", import.meta.url);
    const photo = await decodePhoto(new Uint8Array(readFileSync(new URL("palace-stairs.jpg", dir)))); // prettier-ignore
    const depth = unpackDepth(new Uint8Array(readFileSync(new URL("palace-stairs.depth", dir))));
    const s = buildPhotoSplats(photo, depth, { count: COUNT, depth: 0.5 });
    expect(sharpGap(s)).toBeGreaterThanOrEqual(0.01 - 1e-6);
    expect(splatGap(s)).toBeGreaterThan(0);
  });

  test("each piece of surface has one layer, as the splats do", () => {
    const { photo, depth } = portrait();
    const s = buildPhotoSplats(photo, depth, { count: COUNT, depth: 0.5 });
    expect(s.cellBand.length).toBe(s.gx * s.gy);
    // the face is one layer, and the wall another, farther back
    const at = (u, v) => s.cellBand[Math.floor(v * s.gy) * s.gx + Math.floor(u * s.gx)];
    const face = new Set();
    for (const [u, v] of [[0.45, 0.3], [0.55, 0.5], [0.4, 0.45], [0.6, 0.35]]) face.add(at(u, v)); // prettier-ignore
    expect(face.size).toBe(1);
    expect(at(0.08, 0.2)).toBeLessThan([...face][0]);
  });
});

test.describe("the Sound choice", () => {
  test("paper, a chime, pop-up layers, a water drop, none; no wind or whoosh", () => {
    expect(DEPTH_SOUNDS.map((x) => x.id)).toEqual(["paper", "chime", "layers", "drop", "none"]);
    expect(depthSound({})).toBe(null); // Paper: the toy's own sound (src/toy-sounds.js)
    expect(depthSound({ sound: "paper" })).toBe(null);
    expect(depthSound({ sound: "none" })).toEqual([]);
    // a scene that says "custom" without your sound in this page plays Paper
    expect(depthSound({ sound: "custom" })).toBe(null);
    const all = JSON.stringify([...DEPTH_SOUNDS.map((x) => x.spec), toySound("photo-3d")]);
    expect(all).not.toMatch(/"(wind|whoosh|breath)"/);
    // the plucks: four, rising as the layers rise and falling as they settle
    const up = depthSound({ sound: "layers" }).on;
    expect(up.length).toBe(4);
    expect(up.map((x) => x.f)).toEqual([...up.map((x) => x.f)].sort((a, b) => a - b));
  });

  test("picked in the panel: saved in the scene; your own sound stays in memory only", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
    await expect(page.locator("#pdp-sound-paper")).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.getElementById("pdp-sound-layers").click());
    await expect(page.locator("#pdp-sound-layers")).toHaveAttribute("aria-pressed", "true");
    const opt = () => page.evaluate(() => window.__splashery.player.scene.toy.options.sound);
    expect(await opt()).toBe("layers");
    // the tap plays it (the app asks the recipe)
    const tap = await page.evaluate(() => {
      const app = window.__splashery.app;
      return JSON.stringify(app.ownSound(app.player.scene.toy));
    });
    expect(tap).toContain('"harp"');
    // Your own sound: a short WAV made here, never in the scene, the link or storage.
    const wav = (() => {
      const n = 4000;
      const b = Buffer.alloc(44 + n * 2);
      b.write("RIFF", 0);
      b.writeUInt32LE(36 + n * 2, 4);
      b.write("WAVEfmt ", 8);
      b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20);
      b.writeUInt16LE(1, 22);
      b.writeUInt32LE(8000, 24);
      b.writeUInt32LE(16000, 28);
      b.writeUInt16LE(2, 32);
      b.writeUInt16LE(16, 34);
      b.write("data", 36);
      b.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 3)), 44 + i * 2);
      return b;
    })();
    await page.setInputFiles("#pdp-sound-file", { name: "my-sound.wav", mimeType: "audio/wav", buffer: wav }); // prettier-ignore
    await expect(page.locator("#pdp-sound-custom")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".pdp-sound .note").last()).toContainText("my-sound.wav");
    expect(await opt()).toBe("custom");
    const saved = await page.evaluate(() => {
      const app = window.__splashery.app;
      const spec = app.ownSound(app.player.scene.toy);
      const scene = JSON.stringify(app.player.scene);
      const store = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      return { spec, scene, store, link: location.href };
    });
    expect(saved.spec.voice).toBe("sample");
    for (const t of [saved.scene, saved.store, saved.link]) {
      expect(t).not.toContain("my-sound");
      expect(t).not.toContain("blob:");
      expect(t).not.toContain(saved.spec.file);
    }
  });
});

// The Sharp picture face on, frozen halfway through the rise, with its backing drawn magenta:
// face on, the backing shows only through the cuts, as it does with the depth fully up or flat.
test.describe("the Sharp picture, frozen mid-tap", () => {
  test.setTimeout(300_000);

  test("a synthetic portrait: no more backing on show halfway than at the ends", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(async () => {
      const { usePhoto } = await import("/src/packs/photo-3d.js");
      const { portrait } = await import("/tests/pdp-portrait.mjs");
      const p = portrait();
      usePhoto(p.photo, p.depth, "Synthetic portrait");
      await window.__splashery.app.chooseToy("photo-3d");
    });
    await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "photo-3d");
    await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
    await page.evaluate(() =>
      window.__splashery.app.setToyOptions({ source: "custom", depth: 0.7 }),
    );
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom, null, { timeout: 120_000 }); // prettier-ignore
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
    await page.evaluate(() => window.__psv.tint(true));
    // the middle of the face: the nose below the glasses (picture coordinates, as screen pixels;
    // the glasses' rims are depth steps, cut at every moment)
    const box = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const at = (u, v) => pl.stage.toScreen(pl.fromRecipe([(u - 0.5) * 0.75, 0.5 - v, 0]));
      const a = at(0.45, 0.44);
      const b = at(0.55, 0.52);
      return { x0: Math.round(a[0]), y0: Math.round(a[1]), x1: Math.round(b[0]), y1: Math.round(b[1]) }; // prettier-ignore
    });
    const magenta = async (flat) => {
      await page.evaluate((v) => {
        window.__splashery.player.motion.setControl("flat", v, { snap: true });
        window.__splashery.player.stage.requestRender();
      }, flat);
      await page.waitForTimeout(700);
      const png = PNG.sync.read(await page.locator("canvas").first().screenshot());
      const dpr = png.width / 390;
      const count = (x0, y0, x1, y1) => {
        let n = 0;
        let all = 0;
        for (let y = Math.round(y0 * dpr); y < Math.round(y1 * dpr); y++)
          for (let x = Math.round(x0 * dpr); x < Math.round(x1 * dpr); x++) {
            const i = (y * png.width + x) * 4;
            if (png.data[i] > 200 && png.data[i + 1] < 70 && png.data[i + 2] > 200) n++;
            all++;
          }
        return n / all;
      };
      return { face: count(box.x0, box.y0, box.x1, box.y1), all: count(0, 0, 390, png.height / dpr) }; // prettier-ignore
    };
    const flat = await magenta(1);
    const up = await magenta(0);
    const mids = [];
    for (const f of [0.75, 0.6, 0.5, 0.4, 0.25]) mids.push(await magenta(f));
    test.info().annotations.push({ type: "magenta share", description: JSON.stringify({ flat, up, mids }) }); // prettier-ignore
    // On the nose, no more of the backing at any moment than at the ends, where it shows only
    // through the cut along the nose's edge (before, a slab of it came out over the nose halfway).
    for (const m of mids) expect(m.face).toBeLessThanOrEqual(Math.max(flat.face, up.face) + 0.01);
    // Halfway (r = 0.5, the sway at its center, face on), no more of it anywhere than at the ends.
    expect(mids[2].all).toBeLessThanOrEqual(Math.max(flat.all, up.all) * 1.25 + 0.001);
    expect(errors).toEqual([]);
  });
});
