// Lane G (image-to-3D): the two scans made from one photo each. Their rigs
// move the whole toy (tests/taps.spec.mjs covers kit toys only), so here each
// tap is played frame by frame: every number stays finite, the toy never
// sinks below the table, and it ends exactly at rest.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RIGS } from "../src/rigs.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";

const G = ["pencil-real", "tin-can-real"];

function play(rig) {
  const ctl = rig.controls.find((x) => x.key === rig.action.key);
  const frames = [];
  for (let v = 1; v >= 0; v -= 0.005) {
    const out = { parts: {}, fx: {}, body: null };
    rig.drive(0, { [ctl.key]: v }, out, { tap: { n: 3 } });
    frames.push(out.body);
  }
  return frames;
}

for (const id of G) {
  test(`${id}: listed, packed, credited and has a sound`, () => {
    const toy = TOYS.find((t) => t.id === id);
    expect(toy?.kind).toBe("captured");
    for (const url of [toy.url, toy.urlWeak, `assets/toys/${id}/thumb.webp`])
      expect(fs.existsSync(url), url).toBe(true);
    expect(fs.statSync(toy.url).size).toBeLessThan(5 * 1024 * 1024);
    expect(toy.credit.license).toMatch(/^(CC0 1\.0|CC BY 2\.0)$/);
    expect(TOY_SOUNDS[id]).toBeTruthy();
  });

  test(`${id}: the tap moves the whole toy and ends at rest`, () => {
    const frames = play(RIGS[id]);
    let moved = 0;
    for (const body of frames) {
      if (!body) continue;
      const q = body.quat || [0, 0, 0, 1];
      const o = body.offset || [0, 0, 0];
      for (const x of [...q, ...o]) expect(Number.isFinite(x)).toBe(true);
      expect(o[1]).toBeGreaterThan(-1e-6);
      moved = Math.max(moved, 1 - Math.abs(q[3]) + Math.hypot(...o));
    }
    expect(moved).toBeGreaterThan(0.05);
    const last = frames.at(-1) || { quat: [0, 0, 0, 1], offset: [0, 0, 0] };
    const q = last.quat || [0, 0, 0, 1];
    expect(Math.abs(q[3])).toBeCloseTo(1, 4);
    for (const x of last.offset || []) expect(Math.abs(x)).toBeLessThan(1e-3);
  });
}

// The lane's screenshots (g-*.png): each toy in the middle of its tap, on a
// phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["pencil-real", "Real pencil", 800],
  ["tin-can-real", "Real tin can", 350],
]) {
  test(`${id} mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h, mobile] of [
      [390, 844, true],
      [1440, 900, false],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        ...(mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(e.message));
      await page.goto("/?renderer=webgl2&profile=weak");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `g-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

// Looks for captured toys (src/toys.js): the scene option `look` picks one of
// a scan's files; no look, or an unknown one, is the first (the default).
test("a scan's look is picked from the scene and survives a link", async () => {
  const { lookOption, pickLook } = await import("../src/toys.js");
  const { encodeSceneHash, decodeSceneHash } = await import("../src/codec.js");
  const { createScene, normalizeScene } = await import("../src/state.js");
  const def = {
    id: "demo",
    url: "a.sog",
    looks: [
      { id: "plain", label: "Plain" },
      { id: "red", label: "Red", url: "a-red.sog", urlWeak: "a-red-lite.sog" },
    ],
  };
  expect(pickLook({ id: "x", url: "x.sog" }, { look: "red" })).toBe(null);
  expect(pickLook(def, undefined).id).toBe("plain");
  expect(pickLook(def, {}).id).toBe("plain");
  expect(pickLook(def, { look: "nope" }).id).toBe("plain");
  expect(pickLook(def, { look: "red" }).url).toBe("a-red.sog");
  const opt = lookOption(def);
  expect(opt).toMatchObject({ key: "look", type: "select", default: "plain" });
  expect(opt.choices.map((c) => c.id)).toEqual(["plain", "red"]);
  // A link carries only the look's id; a link without one has no options.
  const scene = createScene();
  scene.toy = { kind: "builtin", id: "demo", options: { look: "red" } };
  const back = normalizeScene(await decodeSceneHash(await encodeSceneHash(scene)));
  expect(back.toy.options).toEqual({ look: "red" });
  scene.toy = { kind: "builtin", id: "demo" };
  const old = normalizeScene(await decodeSceneHash(await encodeSceneHash(scene)));
  expect(old.toy.options).toBeUndefined();
});

// In the app: a link with a look opens that look's files, the Toy tab's Look
// choice loads another, and an old link (no look) opens the default.
test("the Real pencil opens in a linked look, switches looks, and old links still load", async ({
  page,
}) => {
  const { encodeSceneHash } = await import("../src/codec.js");
  const { createScene } = await import("../src/state.js");
  const loaded = [];
  page.on("request", (r) => {
    const m = r.url().match(/pencil-real\/(pencil-real[a-z-]*)\.sog$/);
    if (m) loaded.push(m[1].replace(/-lite$/, ""));
  });
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  const open = async (options) => {
    const scene = createScene();
    scene.toy = { kind: "builtin", id: "pencil-real", ...(options ? { options } : {}) };
    await page.goto("about:blank");
    loaded.length = 0;
    await page.goto(`/?renderer=webgl2&profile=weak#s=${await encodeSceneHash(scene)}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#toy-status")).toHaveText(/^Real pencil/, { timeout: 180_000 });
  };
  const look = page.locator("#toy-options select");

  await open({ look: "red" });
  expect(loaded).toEqual(["pencil-real-red"]);
  await expect(look).toHaveValue("red");
  expect(await look.locator("option").count()).toBe(7);

  loaded.length = 0;
  await look.selectOption("original");
  await expect.poll(() => loaded).toEqual(["pencil-real-original"]);
  await expect(page.locator("#toy-status")).toHaveText(/^Real pencil/, { timeout: 180_000 });
  expect(await page.evaluate(() => window.__splashery.player.scene.toy.options)).toEqual({
    look: "original",
  });

  // An old link, from before looks: the default (yellow) files.
  await open(null);
  expect(loaded).toEqual(["pencil-real"]);
  await expect(look).toHaveValue("yellow");
  // An unknown look falls back to the default too.
  await open({ look: "plaid" });
  expect(loaded).toEqual(["pencil-real"]);
  expect(problems).toEqual([]);
});

test("every look's files exist and stay small", () => {
  for (const id of G) {
    const toy = TOYS.find((t) => t.id === id);
    expect(toy.looks.length).toBeGreaterThan(2);
    expect(toy.looks[0].url).toBeUndefined();
    expect(toy.looks.some((l) => l.id === "original")).toBe(true);
    for (const l of toy.looks.slice(1)) {
      for (const url of [l.url, l.urlWeak]) {
        expect(fs.existsSync(url), url).toBe(true);
        expect(fs.statSync(url).size).toBeLessThan(3 * 1024 * 1024);
      }
    }
  }
});
