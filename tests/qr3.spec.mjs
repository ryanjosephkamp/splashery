// Lane QR r3 (docs/handoff/QRr3.md): the QR code toy's crisper modules, its
// new motions, Alive's patterns and speed, and the color and flag themes.
// The rule throughout: a code that doesn't scan is a failure, so every
// motion must end on a code that reads, and every Alive frame must read.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { encodeQR } from "../src/qr/encode.js";
import { buildCode, PRESETS, pathDistances, contrast, hexRGB } from "../src/qr/build.js";
import { THEMES, TARGET, flagTheme } from "../src/qr/themes.js";
import { MOTION_SECS, PATTERNS } from "../src/qr/field.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const URL0 = "https://ryanjosephkamp.github.io/splashery/";

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const readURL = (url) => {
  const png = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
};

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr && window.__splashery.qr.info().size, null, { timeout: 60_000 }); // prettier-ignore
  await page.evaluate(() => (window.__splashery.qr.autoCheck = false));
  return errors;
}

// ---- In Node ------------------------------------------------------------------------------

test("every theme keeps 4.5 : 1, and a flag's pale colors never become modules", () => {
  expect(THEMES.filter((t) => t.family === "palette").length).toBeGreaterThanOrEqual(10);
  expect(THEMES.filter((t) => t.family === "flag").length).toBeGreaterThanOrEqual(20);
  for (const t of THEMES) {
    expect(t.contrast, t.id).toBeGreaterThanOrEqual(TARGET);
    for (const k of ["fg", "fg2", "eye"])
      if (t[k]) expect(contrast(hexRGB(t[k]), hexRGB(t.bg)), `${t.id} ${k}`).toBeGreaterThanOrEqual(TARGET); // prettier-ignore
  }
  // Germany: black and red on gold; the red darkened just enough, and said.
  const de = THEMES.find((t) => t.id === "flag-de");
  expect(de.bg).toBe("#ffcc00");
  expect(de.fg).toBe("#000000");
  expect(de.notes.join(" ")).toMatch(/red is darkened \(3.41 : 1/);
  // Brazil: its yellow is too pale for a module and colors Alive instead.
  const br = THEMES.find((t) => t.id === "flag-br");
  expect(br.wave).toBe("#fedd00");
  expect([br.fg, br.fg2, br.eye]).not.toContain("#fedd00");
  // A flag with no pale color gets white light modules.
  const t = flagTheme({
    id: "x",
    label: "X",
    colors: [
      ["red", "#aa0000"],
      ["green", "#006600"],
    ],
  });
  expect(t.bg).toBe("#ffffff");
  expect(t.notes.join(" ")).toMatch(/no pale color/);
});

test("crisp edges: thin ring splats, within the budget, and the old lattice when asked", () => {
  const code = encodeQR(URL0, "M");
  const o = { style: "classic", ...PRESETS.classic };
  const r = buildCode(code, o, 133000);
  expect(r.scale).toBe(1);
  expect(r.splats.length).toBeLessThanOrEqual(133000);
  // The outermost rings are 0.03 of a module across (0.55 × 0.03 as a scale).
  const thin = r.splats.filter((s) => s.params[0] > 0 && Math.min(s.scales[0], s.scales[1]) < 0.02);
  expect(thin.length).toBeGreaterThan(5000);
  // A big code at a small budget coarsens instead of overflowing.
  const big = encodeQR("x".repeat(200), "M");
  const rb = buildCode(big, o, 60000);
  expect(rb.splats.length).toBeLessThan(60000 * 2);
  // Path distances: 0 at each path's start, growing by one per step.
  const d = pathDistances(code);
  expect(Math.max(...d)).toBeGreaterThan(10);
  expect(d[0]).toBe(0); // the top-left finder's corner starts its path
  expect(d[1]).toBe(1);
});

test("every motion has a length, and every Alive pattern a label", () => {
  for (const k of ["ripple", "flap", "fold", "rain", "knock", "cloud"])
    expect(MOTION_SECS[k], k).toBeGreaterThan(2);
  expect(PATTERNS.map((p) => p.id)).toEqual(["wave", "sweep", "pulse", "flow", "rainbow", "current", "charge", "scan"]); // prettier-ignore
});

// ---- In the browser -----------------------------------------------------------------------

test("each new motion moves the code and ends on a code that scans", async ({ page }) => {
  test.setTimeout(480_000);
  const errors = await open(page);
  const out = await page.evaluate(async () => {
    const qr = window.__splashery.qr;
    await qr.set({ style: "classic" });
    const res = {};
    for (const motion of ["ripple", "flap", "fold", "rain", "knock", "cloud"]) {
      res[motion] = {
        mid: await qr.frame({ motion, q: motion === "knock" ? 0.15 : 0.4, size: 480, knock: [0, 0] }), // prettier-ignore
        end: await qr.frame({ motion, q: 1, size: 480 }),
      };
    }
    res.rest = await qr.frame({ size: 480 });
    return res;
  });
  expect(readURL(out.rest)).toBe(URL0);
  for (const [motion, f] of Object.entries(out)) {
    if (motion === "rest") continue;
    expect(f.mid, `${motion} moves`).not.toBe(out.rest);
    expect(readURL(f.end), `${motion} ends on a code that scans`).toBe(URL0);
  }
  // Mid-motion pictures that break the code apart don't read (the motion is real).
  for (const motion of ["fold", "rain", "cloud"])
    expect(readURL(out[motion].mid), motion).toBe(null);
  expect(errors).toEqual([]);
});

test("Alive: every pattern scans on every sampled frame, in a flat and a deep style", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await open(page);
  const failed = [];
  for (const style of ["rounded", "bricks"]) {
    for (const pattern of [
      "wave",
      "sweep",
      "pulse",
      "flow",
      "rainbow",
      "current",
      "charge",
      "scan",
    ]) {
      const frames = await page.evaluate(
        async ({ style, pattern }) => {
          const qr = window.__splashery.qr;
          await qr.set({ style, alivePattern: pattern });
          const list = [];
          for (let k = 0; k < 4; k++) list.push(await qr.frame({ alive: 1, phase: (k * Math.PI) / 2 + 0.3, size: 480 })); // prettier-ignore
          return list;
        },
        { style, pattern },
      );
      frames.forEach((f, k) => {
        if (readURL(f) !== URL0) failed.push(`${style} ${pattern} frame ${k}`);
      });
    }
  }
  expect(failed).toEqual([]);
});

test("the Alive speed slider runs the colors slower and faster", async ({ page }) => {
  await open(page);
  const rates = await page.evaluate(async () => {
    const { app } = window.__splashery;
    const { speedOf } = await import("/src/packs/qr.js");
    return [speedOf(0), speedOf(0.5), speedOf(1), app.player.motion.state.speed];
  });
  expect(rates[0]).toBeCloseTo(0.25, 5);
  expect(rates[1]).toBeCloseTo(1, 5);
  expect(rates[2]).toBeCloseTo(4, 5);
  expect(rates[3]).toBeCloseTo(0.5, 5);
});

test("themes and flags apply from the panel, show their contrast and scan", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.evaluate(() => window.__splashery.app.ui?.showTab?.("toy"));
  const pick = async (fn) => {
    await page.evaluate(fn);
    await page.waitForFunction(() => window.__splashery.qr.info().options.theme, null, { timeout: 60_000 }); // prettier-ignore
    return page.evaluate(async () => {
      const qr = window.__splashery.qr;
      qr.scanView();
      return { info: qr.info(), check: await qr.check(), note: document.getElementById("qr-theme-note")?.textContent }; // prettier-ignore
    });
  };
  const ocean = await pick(() => document.getElementById("qr-theme-ocean").click());
  expect(ocean.info.options.theme).toBe("ocean");
  expect(ocean.check.ok).toBe(true);
  expect(ocean.note).toMatch(/Ocean: contrast \d/);
  const de = await pick(() => {
    const s = document.getElementById("qr-flag");
    s.value = "flag-de";
    s.dispatchEvent(new Event("change"));
  });
  expect(de.info.options.theme).toBe("flag-de");
  expect(de.info.options.bg).toBe("#ffcc00");
  expect(de.check.ok).toBe(true);
  expect(de.note).toMatch(/Germany's flag colors/);
  expect(de.note).toMatch(/darkened/);
});

test("a tap knocks the modules loose where it lands; a link keeps the pattern and theme", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await open(page);
  const fired = await page.evaluate(async () => {
    const { app, qr } = window.__splashery;
    await qr.set({ style: "dots", alivePattern: "current" });
    await qr.theme("sunset");
    const r = qr.screenRect();
    // Tap a quarter of the way in from the top-left corner.
    const x = r.x + r.width * 0.3;
    const y = r.y + r.height * 0.3;
    const canvas = app.player.stage.canvas;
    for (const type of ["pointerdown", "pointerup"])
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true, button: 0 })); // prettier-ignore
    canvas.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, bubbles: true }));
    await new Promise((res) => setTimeout(res, 400));
    const { encodeSceneHash } = await import("/src/codec.js");
    return { knock: app.player.motion.state.knock ?? 0, hash: encodeSceneHash(window.__splashery.exportScene()) }; // prettier-ignore
  });
  expect(fired.knock).toBeGreaterThan(0);
  await page.goto(`${APP}#s=${fired.hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
  const back = await page.evaluate(() => window.__splashery.qr.info().options);
  expect(back.style).toBe("dots");
  expect(back.alivePattern).toBe("current");
  expect(back.theme).toBe("sunset");
});
