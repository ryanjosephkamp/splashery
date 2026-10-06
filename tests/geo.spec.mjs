// Lane Earth and maps (docs/handoff/Geo.md): the geo pack's toys build from their data
// snapshots, the snapshots hold what the tools say, and the earthquakes toy reads the USGS
// feed only when it opens or its plaque is tapped (mocked here, so the test never depends on
// the network), falling back to its dated snapshot when the feed can't be reached.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import zlib from "node:zlib";
import { RECIPES, quakeRows, tideAt, birdAt } from "../src/packs/geo.js";
import { parseGeo } from "../src/geo/data.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const IDS = [
  "grand-canyon",
  "st-helens",
  "sea-floor",
  "tide-harbor",
  "hurricane",
  "relief-map",
  "living-city",
  "stork-migration",
  "earthquakes",
];
const FEED = /earthquake\.usgs\.gov\/earthquakes\/feed\/v1\.0\/summary\/2\.5_week\.geojson/;

async function build(id, options = {}) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count: 60000, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

const geo = (file) => {
  const b = fs.readFileSync(file);
  return parseGeo(new Uint8Array(file.endsWith(".gz") ? zlib.gunzipSync(b) : b));
};

test.describe("Earth and maps", () => {
  test("every toy is on the geo shelf, in labs, with help, a sound and a recipe", () => {
    for (const id of IDS) {
      const def = TOYS.find((t) => t.id === id);
      expect(def, id).toBeTruthy();
      expect(def.category).toBe("geo");
      expect(def.labs).toBe(true);
      expect(RECIPES[id], id).toBeTruthy();
      expect(TOY_SOUNDS[id], id).toBeTruthy();
      expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
    }
  });

  test("each toy builds with finite splats, and its tap's control rests at 0", async () => {
    for (const id of IDS) {
      const ctx = await build(id);
      const { buf } = ctx;
      expect(buf.count, id).toBeGreaterThan(20000);
      for (let i = 0; i < buf.count * 3; i += 97)
        expect(Number.isFinite(buf.pos[i]), id).toBe(true);
      const key = RECIPES[id].action.key;
      const ctl = RECIPES[id].controls.find((c) => c.key === key);
      expect(["pulse", "toggle"]).toContain(ctl.type);
      // The drive at rest and partway: finite parts and tokens.
      for (const v of [0, 0.5]) {
        const out = { parts: {} };
        RECIPES[id].drive(1, { [key]: v, flood: v }, out, { data: ctx.kit.data });
        for (const tk of out.tokens || []) for (const x of tk.offset || []) expect(Number.isFinite(x), id).toBe(true); // prettier-ignore
        for (const p of Object.values(out.parts)) for (const x of p.offset || []) expect(Number.isFinite(x), id).toBe(true); // prettier-ignore
      }
    }
  });

  test("the snapshots hold real-looking data", () => {
    const msh = geo("assets/toys/st-helens/terrain.bin.gz");
    // The summit was about 2,950 m before 1980 and is about 2,550 m now.
    expect(msh.layer("before").max).toBeGreaterThan(2850);
    expect(msh.layer("after").max).toBeLessThan(2600);
    const sea = geo("assets/toys/sea-floor/terrain.bin.gz");
    expect(sea.layer("height").min).toBeLessThan(-10000); // the Challenger Deep
    const th = geo("assets/toys/tide-harbor/terrain.bin.gz");
    const lv = Array.from(th.layer("tide").data);
    expect(Math.max(...lv) - Math.min(...lv)).toBeGreaterThan(3.5); // a spring tide
    expect(Math.abs(lv[0] - lv[lv.length - 1])).toBeLessThan(0.3); // a lunar day closes
    expect(tideAt(lv, 0)).toBeCloseTo(lv[0], 5);
    const hu = geo("assets/toys/hurricane/storm.bin.gz");
    expect(hu.meta.track[0].kt).toBe(70);
    expect(hu.meta.track[hu.meta.track.length - 1].kt).toBe(155);
    const sm = geo("assets/toys/stork-migration/migration.bin");
    expect(sm.meta.birds.length).toBe(30);
    for (const b of sm.meta.birds) {
      expect(Math.min(...b.pts.map((p) => p[2]))).toBeLessThan(15); // reached Africa
      for (let i = 1; i < b.pts.length; i++)
        expect(b.pts[i][0]).toBeGreaterThanOrEqual(b.pts[i - 1][0]);
    }
    const q = birdAt(
      [
        [0, 10, 50],
        [10, 20, 40],
      ],
      5,
    );
    expect(q.lon).toBeCloseTo(15, 6);
    expect(q.lat).toBeCloseTo(45, 6);
    const snap = JSON.parse(fs.readFileSync("assets/toys/earthquakes/snapshot.json", "utf8"));
    for (const f of ["week", "month", "year"]) {
      const ev = snap.feeds[f].events;
      expect(ev.length, f).toBeGreaterThan(50);
      for (let i = 1; i < ev.length; i++) expect(ev[i][0]).toBeGreaterThanOrEqual(ev[i - 1][0]);
      for (const [, lon, lat, depth, mag] of ev) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
        expect(Number.isFinite(depth) && Number.isFinite(mag)).toBe(true);
      }
    }
  });

  test("round 2: every terrain toy is a grid of splats sized to its spacing, with its picture", async () => {
    // The owner's notes of October 5, 2026: "please make sharper". Each sample
    // is one splat on a regular grid (no random placement).
    const ctx = await build("grand-canyon");
    expect(ctx.kit.data.grid.spacing).toBeGreaterThan(0);
    expect(ctx.kit.data.grid.pts).toBeGreaterThan(20000);
    for (const id of IDS) expect(RECIPES[id].kernel, id).toBe("sharp");
    for (const f of ["grand-canyon/color.jpg", "st-helens/color.jpg", "tide-harbor/color.jpg", "relief-map/color.jpg", "relief-map/land.jpg", "hurricane/color.jpg", "stork-migration/earth.jpg", "earthquakes/earth.jpg"]) // prettier-ignore
      expect(fs.statSync(`assets/toys/${f}`).size, f).toBeGreaterThan(50000);
  });

  test("round 3: the living city is the Helsinki reality mesh, credited, with its night lights", async () => {
    // The owner, October 5, 2026: "I'm fine with the Helsinki open reality mesh. Let's do it."
    const g = parseGeo(new Uint8Array(zlib.gunzipSync(fs.readFileSync("assets/toys/living-city/city.bin.gz")))); // prettier-ignore
    expect(g.meta.count).toBeGreaterThan(400000);
    expect(g.meta.span[0]).toBeCloseTo(550, 0); // meters east-west
    expect(g.meta.source).toContain("CC BY 4.0");
    expect(fs.statSync("assets/toys/living-city/city.bin.gz").size).toBeLessThan(8 * 1024 * 1024);
    expect(RECIPES["living-city"].credits[0]).toMatchObject({ author: "City of Helsinki", license: "CC BY 4.0" }); // prettier-ignore
    expect(fs.readFileSync("CREDITS.md", "utf8")).toContain("Helsinki 3D reality mesh");
    const ctx = await build("living-city");
    // The day city fades out and the night city and its lights fade in on the same channel.
    expect(ctx.buf.count).toBeGreaterThan(60000);
  });

  test("the feed reader keeps earthquakes with every number, in time order", () => {
    const gj = {
      features: [
        {
          properties: { type: "earthquake", time: 2000e3, mag: 4.1 },
          geometry: { coordinates: [10, 20, 5] },
        },
        {
          properties: { type: "quarry blast", time: 1500e3, mag: 2 },
          geometry: { coordinates: [1, 2, 0] },
        },
        {
          properties: { type: "earthquake", time: 1000e3, mag: null },
          geometry: { coordinates: [1, 2, 3] },
        },
        {
          properties: { type: "earthquake", time: 500e3, mag: 3 },
          geometry: { coordinates: [-150, -20, 30] },
        },
      ],
    };
    expect(quakeRows(gj)).toEqual([
      [500, -150, -20, 30, 3],
      [2000, 10, 20, 5, 4.1],
    ]);
  });

  test("nothing loads before a toy opens; the feed is read live, refreshed and falls back", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    let calls = 0;
    let fail = false;
    const now = Date.UTC(2026, 9, 5, 12, 34);
    await page.route(FEED, (route) => {
      calls++;
      if (fail) return route.abort();
      return route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          metadata: { generated: now, title: "test" },
          features: [
            {
              properties: { type: "earthquake", time: now - 3.6e6, mag: 5.2 },
              geometry: { coordinates: [142, 38, 30] },
            },
            {
              properties: { type: "earthquake", time: now - 7.2e6, mag: 3.1 },
              geometry: { coordinates: [-155, 19, 8] },
            },
          ],
        }),
      });
    });
    await page.goto(APP + "&geofeed=live");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const geoFiles = (u) => /packs\/geo\.js|toys\/(grand-canyon|st-helens|sea-floor|tide-harbor|hurricane|relief-map|living-city|stork-migration|earthquakes)\/[^t]/.test(u); // prettier-ignore
    expect(requests.filter(geoFiles)).toEqual([]);
    expect(calls).toBe(0);
    await page.evaluate(() => window.__splashery.app.chooseToy("earthquakes"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.quakes, null, { timeout: 90_000 }); // prettier-ignore
    let q = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.quakes);
    expect(q).toMatchObject({ live: true, count: 2, feed: "week" });
    expect(calls).toBe(1);
    const credit = await page.evaluate(
      () => window.__splashery.player.toyInfo.recipe.credits[0].title,
    );
    expect(credit).toContain("read live");
    expect(credit).toContain("October 5, 2026, 12:34 UTC");
    // A tap on the plaque fetches again (and this time the feed is down).
    fail = true;
    await page.evaluate(() => {
      const { player } = window.__splashery;
      const tf = player.motion.ctx.transform;
      player.act([0, -1.35, 0.4].map((v, i) => (v - tf.center[i]) * tf.scale));
    });
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.quakes?.live === false, null, { timeout: 90_000 }); // prettier-ignore
    expect(calls).toBe(2);
    q = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.quakes);
    expect(q.count).toBeGreaterThan(50); // the snapshot
    expect(await page.evaluate(() => window.__splashery.player.toyInfo.recipe.credits[0].title)).toContain("snapshot"); // prettier-ignore
    // The year of the catalog never calls the feed.
    await page.evaluate(() => window.__splashery.app.setToyOption("feed", "year"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.quakes?.feed === "year", null, { timeout: 90_000 }); // prettier-ignore
    expect(calls).toBe(2);
    expect(errors).toEqual([]);
  });

  for (const id of IDS)
    test(`screenshots of ${id} at phone and desktop size`, async ({ browser }) => {
      test.setTimeout(360_000);
      for (const [w, h] of [
        [390, 844],
        [1440, 900],
      ]) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(APP);
        await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
        await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
        await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.kit?.data, id, { timeout: 90_000 }); // prettier-ignore
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tests/screenshots/geo-${id}-${w}x${h}.png` });
        await page.close();
      }
    });
});
