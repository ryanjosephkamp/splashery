// Lane Viewer (docs/handoff/Viewer.md): whole PDF figures (no black boxes),
// a pinch that only zooms, the tilt lock and Reset view, the top-bar
// settings, flags per toy, and the terms of use.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { buildSheet } from "../src/picture-splats.js";
import { OrbitCamera, Gestures, PINCH_TWIST } from "../src/camera.js";
import { createScene } from "../src/state.js";
import { encodeSceneHash } from "../src/codec.js";
import { TOYS } from "../src/toys.js";
import { RECIPES as PICTURES } from "../src/packs/pictures.js";
import { RECIPES as SCREENS } from "../src/packs/screens.js";
import { RECIPES as SPLATTING } from "../src/packs/splatting.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const FIGURES = "http://127.0.0.1:4173/tests/fixtures/vw/figures.pdf";

// A half float that is NaN or infinite (drawn black by the GPU).
const badHalf = (h) => (h & 0x7c00) === 0x7c00;

async function ready(page, url = APP) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Waits until every picture sheet shows what the toy wants.
async function waitSheet(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      if (!p?.media) return false;
      window.__splashery.player.stage.requestRender();
      return (
        !p.retiring.length &&
        p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) &&
        p.splats() > 0
      );
    },
    null,
    { timeout: 120_000 },
  );
}

test.describe("whole PDF figures", () => {
  test("a flat-colored block never turns the paper NaN (the black boxes)", () => {
    // One 8 x 8 block of each flat color on white paper. Before the fix a
    // flat block's median (rounded to Float32) could sit above its own
    // pixels, leaving none to average: NaN paper, drawn as a black square.
    let bad = 0;
    for (let v = 0; v < 256; v += 1)
      for (const [r, g, b] of [
        [v, v, v],
        [v, 0, 0],
        [0, v, 0],
        [0, 0, v],
        [v, 255 - v, 128],
      ]) {
        // prettier-ignore
        const w = 16;
        const h = 16;
        const px = new Uint8ClampedArray(w * h * 4).fill(255);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px.set([r, g, b, 255], (y * w + x) * 4); // prettier-ignore
        const o = buildSheet({ pixels: px, w, h, method: "ink", origin: [0, 0, 0], right: [1, 0, 0], down: [0, -1, 0], normal: [0, 0, 1] }); // prettier-ignore
        for (let i = 0; i < o.count * 4; i++) if (badHalf(o.color[i])) bad++;
      }
    expect(bad).toBe(0);
  });

  test("every kind of embedded picture builds whole splats at every detail width", async ({
    page,
  }) => {
    await ready(page);
    const res = await page.evaluate(async (url) => {
      const { openMedia } = await import("/src/media.js");
      const { buildSheet } = await import("/src/picture-splats.js");
      const m = await openMedia(url, { profile: "low" });
      const out = [];
      for (const w of [181, 362, 724, 1100, 1448])
        for (let i = 0; i < m.count; i++) {
          const h = Math.round(w / m.aspect(i));
          const c = await m.draw(i, w, h);
          const px = c.getContext("2d").getImageData(0, 0, w, h).data;
          const o = buildSheet({ pixels: px, w, h, method: "ink", origin: [0, 0, 0], right: [1 / w, 0, 0], down: [0, -1 / w, 0], normal: [0, 0, 1] }); // prettier-ignore
          let bad = 0;
          let dark = 0;
          for (let k = 0; k < o.count * 4; k++) if ((o.color[k] & 0x7c00) === 0x7c00) bad++;
          // The figures have no black in them: count black detail pixels.
          for (let k = 0; k < px.length; k += 4) if (px[k] + px[k + 1] + px[k + 2] < 60) dark++;
          out.push({ w, page: i + 1, bad, dark, ink: o.ink });
        }
      m.close();
      return out;
    }, FIGURES);
    expect(res.length).toBe(30);
    for (const r of res) {
      expect(r.bad, `page ${r.page} at ${r.w}`).toBe(0);
      expect(r.dark, `page ${r.page} at ${r.w}`).toBe(0);
      expect(r.ink, `page ${r.page} at ${r.w}`).toBeGreaterThan(0);
    }
  });

  test("the Picture lab shows each figure page with no black on screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, `${APP}&labs=1`);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await page.evaluate((u) => window.__splashery.app.openMedia(u), FIGURES);
    await waitSheet(page);
    const count = await page.evaluate(() => window.__splashery.player.pictures.media.count);
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      await page.evaluate((i) => window.__splashery.player.pictures.go(i), i);
      await waitSheet(page);
      const dark = await page.evaluate(async () => {
        const st = window.__splashery.player.stage;
        st.requestRender();
        await new Promise((r) => setTimeout(r, 300));
        const c = await st.captureFrame();
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 60) n++;
        return n;
      });
      expect(dark, `page ${i + 1}`).toBeLessThan(20);
    }
  });
});

// Two fingers on a fake element: each step moves both pointers to new spots.
function twoFingers(steps) {
  const el = { addEventListener() {}, removeEventListener() {} };
  const calls = [];
  const g = new Gestures(el, { classify: () => "orbit", onPinch: (p) => calls.push(p) });
  const ev = (id, [x, y], t) => ({ pointerId: id, clientX: x, clientY: y, timeStamp: t, pointerType: "touch", button: 0, type: "pointermove" }); // prettier-ignore
  const [a0, b0] = steps[0];
  g.down(ev(1, a0, 0));
  g.down(ev(2, b0, 1));
  steps.slice(1).forEach(([a, b], i) => {
    g.move(ev(1, a, 16 * (i + 1)));
    g.move(ev(2, b, 16 * (i + 1) + 1));
  });
  return calls;
}

// Pointers at distance d and angle ang (radians) around (cx, cy).
const pair = (cx, cy, d, ang) => [
  [cx - (Math.cos(ang) * d) / 2, cy - (Math.sin(ang) * d) / 2],
  [cx + (Math.cos(ang) * d) / 2, cy + (Math.sin(ang) * d) / 2],
];

test.describe("pinch zooms, not turns", () => {
  test("a pinch with a little natural twist and drift only zooms", () => {
    // Fingers spread from 120 to 260 px apart while turning 12 degrees and
    // drifting 14 px: a normal pinch.
    const steps = [];
    for (let i = 0; i <= 20; i++) steps.push(pair(200 + i * 0.7, 400, 120 + i * 7, (i * 0.6 * Math.PI) / 180)); // prettier-ignore
    const calls = twoFingers(steps);
    expect(calls.length).toBe(40);
    expect(calls.every((c) => c.twist === 0)).toBe(true);
    expect(calls.at(-1).mode).toBe("zoom");
    const scale = calls.reduce((k, c) => k * c.scale, 1);
    expect(scale).toBeGreaterThan(2);
    // The app turns the toy only in "drag" mode; the camera keeps its pose.
    const cam = new OrbitCamera();
    const before = { ...cam.tgt };
    for (const c of calls) {
      if (c.mode === "drag") cam.rotateBy(c.dx, c.dy, c.dt);
      cam.zoomBy(1 / c.scale);
      cam.rollBy(-c.twist);
    }
    expect(cam.tgt.yaw).toBe(before.yaw);
    expect(cam.tgt.pitch).toBe(before.pitch);
    expect(cam.tgt.roll).toBe(before.roll);
    expect(cam.tgt.distance).toBeLessThan(before.distance);
  });

  test("a clear twist rolls, from past its dead zone, with no jump", () => {
    const steps = [];
    for (let i = 0; i <= 20; i++) steps.push(pair(200, 400, 150, (i * 2.5 * Math.PI) / 180));
    const calls = twoFingers(steps);
    expect(calls.at(-1).mode).toBe("twist");
    const total = calls.reduce((k, c) => k + c.twist, 0);
    expect(total).toBeCloseTo((50 * Math.PI) / 180 - PINCH_TWIST, 3);
    expect(Math.max(...calls.map((c) => Math.abs(c.twist)))).toBeLessThan(0.1);
  });

  test("two fingers moving together still turn the toy (mode drag)", () => {
    const steps = [];
    for (let i = 0; i <= 10; i++) steps.push(pair(200 + i * 8, 400, 150, 0));
    const calls = twoFingers(steps);
    expect(calls.at(-1).mode).toBe("drag");
  });
});

test.describe("the tilt lock", () => {
  test("every toy on the Pictures and pages shelf starts locked; others stay free", () => {
    const recipes = { ...PICTURES, ...SCREENS, ...SPLATTING };
    const shelf = TOYS.filter((t) => t.category === "pictures").map((t) => t.id);
    expect(shelf.length).toBeGreaterThan(1);
    for (const id of shelf) expect(recipes[id]?.tiltLock, id).toBe(true);
    expect(SPLATTING["gaussian-splatting"].tiltLock).toBeFalsy();
  });

  test("locked, a drag only spins the toy; pitch and roll stay home", () => {
    const cam = new OrbitCamera();
    cam.setState({ yaw: 0, pitch: 0.2, roll: 0, distance: 5 }, { asHome: true });
    cam.setTiltLock(true);
    cam.begin();
    cam.rotateBy(80, 120, 1 / 60);
    cam.rollBy(0.5);
    cam.end();
    for (let i = 0; i < 120; i++) cam.update(1 / 60);
    expect(cam.tgt.pitch).toBe(0.2);
    expect(cam.tgt.roll).toBe(0);
    expect(Math.abs(cam.tgt.yaw)).toBeGreaterThan(0.3);
    // Freed, a drag tilts it; locked again, it eases back home.
    cam.setTiltLock(false);
    cam.rotateBy(0, 120, 1 / 60);
    expect(cam.tgt.pitch).not.toBe(0.2);
    cam.setTiltLock(true);
    expect(cam.tgt.pitch).toBe(0.2);
  });

  test("the Picture lab starts locked, other toys free; a choice stays with its toy", async ({
    page,
  }) => {
    await ready(page, `${APP}&labs=1`);
    const state = () =>
      page.evaluate(() => ({
        pressed: document.getElementById("tilt-toggle").getAttribute("aria-pressed"),
        lock: window.__splashery.player.camera.tiltLock,
      }));
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    expect(await state()).toEqual({ pressed: "false", lock: false });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    expect(await state()).toEqual({ pressed: "true", lock: true });
    // Unlock the lab, visit the cactus (still free), come back: still unlocked.
    await page.click("#tilt-toggle");
    expect(await state()).toEqual({ pressed: "false", lock: false });
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    expect(await state()).toEqual({ pressed: "false", lock: false });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    expect(await state()).toEqual({ pressed: "false", lock: false });
  });

  test("a link's saved pose wins over the lock, and Reset view goes home", async ({ page }) => {
    const scene = createScene({ toy: { kind: "builtin", id: "picture-lab" } });
    scene.camera = { yaw: 0.4, pitch: 0.9, roll: 0.3, distance: 4 };
    await ready(page, `${APP}&labs=1#s=${await encodeSceneHash(scene)}`);
    const cam = () =>
      page.evaluate(() => {
        const c = window.__splashery.player.camera;
        return { lock: c.tiltLock, ...c.getState() };
      });
    expect(await cam()).toMatchObject({ lock: true, pitch: 0.9, roll: 0.3, yaw: 0.4 });
    // Turn it (a yaw only, as it is locked), then Reset view brings it home.
    await page.evaluate(() => window.__splashery.player.camera.rotateBy(200, 200, 0));
    expect(await cam()).toMatchObject({ pitch: 0.9, roll: 0.3 });
    expect((await cam()).yaw).not.toBe(0.4);
    await page.click("#view-reset");
    expect(await cam()).toMatchObject({ pitch: 0.9, roll: 0.3, yaw: 0.4 });
  });
});

test.describe("the top-bar settings", () => {
  test("the turntable button is one setting for every toy, remembered on this device", async ({
    page,
  }) => {
    await ready(page);
    const on = () =>
      page.evaluate(() => ({
        pressed: document.getElementById("turntable-toggle").getAttribute("aria-pressed"),
        scene: window.__splashery.player.scene.autoplay.turntable,
        box: document.getElementById("auto-turntable").checked,
      }));
    expect(await on()).toEqual({ pressed: "true", scene: true, box: true });
    await page.click("#turntable-toggle");
    expect(await on()).toEqual({ pressed: "false", scene: false, box: false });
    await page.evaluate(() => window.__splashery.app.chooseToy("basketball"));
    expect(await on()).toEqual({ pressed: "false", scene: false, box: false });
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await on()).toEqual({ pressed: "false", scene: false, box: false });
    await page.click("#turntable-toggle");
    expect(await on()).toEqual({ pressed: "true", scene: true, box: true });
  });

  test("every round button has a label, a tooltip and fits the phone header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    const boxes = await page.evaluate(() =>
      ["view-reset", "tilt-toggle", "turntable-toggle", "help-toggle", "sound-toggle"].map((id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        return { id, label: el.getAttribute("aria-label"), title: el.title, x: r.x, w: r.width, top: r.top }; // prettier-ignore
      }),
    );
    for (const b of boxes) {
      expect(b.label, b.id).toBeTruthy();
      expect(b.title, b.id).toBeTruthy();
    }
    // In one row, left to right, not overlapping, and clear of the name.
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].w);
      expect(boxes[i].top).toBe(boxes[0].top);
    }
    const name = await page.evaluate(() => document.querySelector(".brand p").getBoundingClientRect().right); // prettier-ignore
    expect(boxes[0].x).toBeGreaterThan(name);
    expect(boxes.at(-1).x + boxes.at(-1).w).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "tests/screenshots/vw-top-bar-390x844.png" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "tests/screenshots/vw-top-bar-1440x900.png" });
  });
});

test.describe("flags per toy", () => {
  test("a flag stays with its toy; the next toy shows its own look", async ({ page }) => {
    await ready(page);
    const flag = () =>
      page.evaluate(() => ({
        pattern: window.__splashery.player.scene.pattern.id,
        flag: window.__splashery.player.scene.pattern.flag,
        picker: document.getElementById("toy-flag").value,
      }));
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    // The picker lives in the Toy tab's Look section now.
    expect(await page.evaluate(() => !!document.querySelector("#toy-look-group #toy-flag"))).toBe(true); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "fr" }));
    await expect.poll(flag).toEqual({ pattern: "flag", flag: "fr", picker: "fr" });
    await page.evaluate(() => window.__splashery.app.chooseToy("basketball"));
    await expect.poll(flag).toMatchObject({ pattern: "none", picker: "" });
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    await expect.poll(flag).toEqual({ pattern: "flag", flag: "fr", picker: "fr" });
  });

  test("a link that carries a flag still loads with it", async ({ page }) => {
    const scene = createScene({ toy: { kind: "builtin", id: "cactus" } });
    scene.pattern = { ...scene.pattern, id: "flag", flag: "jp" };
    await ready(page, `${APP}#s=${await encodeSceneHash(scene)}`);
    const p = await page.evaluate(() => window.__splashery.player.scene.pattern);
    expect(p).toMatchObject({ id: "flag", flag: "jp" });
  });
});

test.describe("terms of use", () => {
  test("the About tab and the README carry the terms", async ({ page }) => {
    await ready(page);
    const text = await page.evaluate(() => document.getElementById("terms-group").textContent);
    for (const words of ["stay on your device", "You are responsible", "whoever hosts that media", "MIT licensed", "without warranty"]) // prettier-ignore
      expect(text).toContain(words);
    const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
    expect(readme).toContain("## Terms of use");
    expect(readme).toContain("without warranty");
  });
});
