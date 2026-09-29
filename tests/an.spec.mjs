// Lane Anatomy: the anatomy atlas (docs/handoff/Anatomy.md). The layers, the peel and the labels
// are checked through the kit (drive() played frame by frame, as in tests/taps.spec.mjs), then in
// the browser: the Labels list beside the stage, and screenshots at phone and desktop size.

import { test, expect } from "@playwright/test";
import { RECIPES, ATLAS } from "../src/packs/anatomy-atlas.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { TOYS } from "../src/toys.js";

const ID = "anatomy-atlas";
const R = RECIPES[ID];
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const { LAYERS, PIECES, LABEL_LIST } = ATLAS;

function build(layer = "skin", count = 24000) {
  const it = buildRecipe(R, { seed: 5, count, options: { layer } }, applyClay);
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value;
}

// drive() at a pulse value v after n taps (n = 0: never tapped).
function frame(data, v, n, c = { labels: 0, peel: 0 }, point = null) {
  const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
  c.peel = v;
  R.drive(1, c, out, { time: 1, R: 1, tap: n ? { n, point, key: "peel" } : null, data });
  return out;
}
const shownLayers = (out) => LAYERS.filter((id) => out.parts[id]?.visible > 0.5);
const moved = (tk) => Math.hypot(...(tk.offset || [0, 0, 0])) > 1e-4 || Math.abs((tk.quat || [0, 0, 0, 1])[3]) < 0.99999; // prettier-ignore

test.describe("the anatomy atlas", () => {
  test("is a labs toy on the Body shelf", () => {
    const def = TOYS.find((t) => t.id === ID);
    expect(def).toMatchObject({ category: "anatomy", kind: "kit", pack: "anatomy-atlas", labs: true }); // prettier-ignore
    expect(R.options.find((o) => o.key === "layer").choices.map((c) => c.id)).toEqual(LAYERS);
    expect(R.controls.find((c) => c.key === R.action.key).type).toBe("pulse");
  });

  test("each layer builds, with every piece solid and in its own layer", () => {
    const ctx = build();
    const { buf, kit } = ctx;
    const partOf = Object.fromEntries(kit.parts.map((p, i) => [p.name, i]));
    const perPart = {};
    const tokPart = new Map();
    for (let i = 0; i < buf.count; i++) {
      const part = buf.anim[i * 4] % 16;
      const kind = buf.anim[i * 4 + 1];
      perPart[part] = (perPart[part] || 0) + 1;
      if (part === partOf.organs) continue;
      // Skin, muscle and bone splats are all pieces (tokens): they move only
      // as solid pieces, never by a morph.
      expect(kind).toBe(KINDS.token);
      const tok = Math.round(buf.anim[i * 4 + 2]);
      if (!tokPart.has(tok)) tokPart.set(tok, part);
      expect(tokPart.get(tok)).toBe(part);
    }
    for (const id of LAYERS) expect(perPart[partOf[id]], id).toBeGreaterThan(1000);
    // Every piece has splats, in its own layer's part.
    PIECES.forEach(([id, layer], i) => {
      expect(tokPart.get(i), id).toBe(partOf[LAYERS[layer]]);
    });
    expect(PIECES.length).toBeLessThanOrEqual(48);
    // At rest each layer shows by itself (the organs show inside the skeleton).
    for (const [L, id] of LAYERS.entries()) {
      const data = build(id, 6000).kit.data;
      const out = frame(data, 0, 0);
      expect(shownLayers(out)).toEqual(L === 2 ? ["skeleton", "organs"] : [id]);
      out.tokens.forEach((tk, i) => {
        expect(tk.visible, PIECES[i][0]).toBe(PIECES[i][1] >= L ? 1 : 0);
        expect(moved(tk)).toBe(false);
      });
    }
  });

  test("a tap peels exactly one layer as solid pieces; four taps bring back the skin", () => {
    const data = build("skin", 8000).kit.data;
    let layer = 0;
    for (let n = 1; n <= 4; n++) {
      const seen = new Set();
      for (let v = 0.98; v > 0.02; v -= 0.04) {
        const out = frame(data, v, n);
        out.tokens.forEach((tk, i) => {
          // Pieces move only by a turn and an offset (a solid move), and
          // every number is finite.
          expect(Object.keys(tk).every((k) => ["base", "offset", "quat", "visible"].includes(k))).toBe(true); // prettier-ignore
          for (const x of [...(tk.offset || []), ...(tk.quat || [])]) expect(Number.isFinite(x)).toBe(true); // prettier-ignore
          if (moved(tk) && tk.visible) seen.add(PIECES[i][1]);
        });
        expect(out.morph ?? null).toBe(null);
      }
      const rest = frame(data, 0, n);
      if (n < 4) {
        // One layer, the outer one, moved; the next one is now on top.
        expect([...seen]).toEqual([layer]);
        layer++;
        expect(shownLayers(rest)[0]).toBe(LAYERS[layer]);
      } else {
        // The fourth tap brings every layer back, and the skin is on top.
        expect([...seen].sort()).toEqual([0, 1, 2]);
        expect(shownLayers(rest)).toEqual(["skin"]);
        rest.tokens.forEach((tk) => expect(tk.visible).toBe(1));
      }
      // The effect ends where the toy rests.
      const last = frame(data, 0.0004, n);
      expect(shownLayers(last)).toEqual(shownLayers(rest));
      last.tokens.forEach((tk, i) => {
        expect(tk.visible, PIECES[i][0]).toBe(rest.tokens[i].visible);
        if (tk.visible) expect(Math.hypot(...(tk.offset || [0, 0, 0]))).toBeLessThan(0.03);
      });
    }
  });

  test("keeps to each tier's splat budget", () => {
    for (const [tier, prof] of Object.entries(PROFILES)) {
      const count = Math.round(Math.min(prof.maxCount, prof.defaultCount * (R.density ?? 1)));
      const { buf } = build("skin", count);
      expect(buf.count, tier).toBeLessThanOrEqual(count * 1.01);
      expect(buf.count, tier).toBeGreaterThan(count * 0.95);
    }
  });

  test("the labels list every part, and a tap highlights the part under it", () => {
    const data = build("skin", 12000).kit.data;
    const listed = new Set();
    for (const [L, id] of LAYERS.entries()) {
      const d = build(id, 4000).kit.data;
      const out = frame(d, 0, 0, { labels: 1, peel: 0 });
      expect(out.legend.items.filter((i) => i.head).map((i) => i.text)).toEqual(["Skin", "Muscles", "Skeleton", "Organs"]); // prettier-ignore
      for (const it of out.legend.items) if (!it.head) listed.add(it.text);
      expect(out.legend.items.filter((i) => !i.head && !i.dim).length).toBe(ATLAS.LABELS[L].length);
    }
    expect([...listed].sort()).toEqual(LABEL_LIST.map((l) => l.name).sort());
    // No labels unless the switch is on.
    expect(frame(data, 0, 0).legend).toBeUndefined();
    // Every label has splats to find it by.
    LABEL_LIST.forEach((l, i) => expect(data.labelPts[i].length, l.name).toBeGreaterThan(0));
    // A tap on the heart (from the skeleton) shows the organs and marks it.
    const d = build("skeleton", 12000).kit.data;
    const c = { labels: 1, peel: 0 };
    const out = frame(d, 0.5, 1, c, [0.02, 1.24, 0.07]);
    expect(out.legend.items.find((i) => i.on)?.text).toBe("Heart");
  });

  test("the Labels switch shows the list beside the stage", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("anatomy-atlas"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.labelPts, null, { timeout: 120_000 }); // prettier-ignore
    await expect(page.locator("#toy-legend")).toBeHidden();
    await page.evaluate(() => window.__splashery.app.setControl("labels", 1));
    await expect(page.locator("#toy-legend")).toBeVisible();
    await expect(page.locator("#toy-legend li.head")).toHaveText(["Skin", "Muscles", "Skeleton", "Organs"]); // prettier-ignore
    await expect(page.locator("#toy-legend li:not(.head)")).toHaveText(ATLAS.LABELS[0]);
    // A tap on the chest peels the skin and marks the muscle under it.
    await page.evaluate(() => {
      const p = window.__splashery.player;
      p.act(p.fromRecipe([0.07, 1.32, 0.1]));
    });
    await expect(page.locator("#toy-legend li.on")).toHaveText("Pectoralis major");
    await page.waitForFunction(() => window.__splashery.player.motion.state.peel === 0, null, { timeout: 30_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.setControl("labels", 0));
    await expect(page.locator("#toy-legend")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("anatomy-atlas"));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.labelPts, null, { timeout: 120_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.setToyOptions({ layer: "skeleton" }));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.layer0 === 2, null, { timeout: 120_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.setControl("labels", 1));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/an-atlas-${w}x${h}.png` });
      await page.close();
    }
  });
});
