// Lane Space r3: the real worlds, sharper, with a tap that zooms in on a spot
// and names it. The place data (Natural Earth for Earth, the IAU Gazetteer
// for the others) names known spots right; the close-up tiles are where the
// maps say; and in the browser a tap on a known spot (Paris, Mount Everest,
// Tycho crater, Olympus Mons) zooms in on it and names it.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { loadPlaces } from "../src/space/places.js";
import { loadZoom, TILES } from "../src/space/zoom.js";
import { loadWorld } from "../src/space/maps.js";
import { worldById } from "../src/space/worlds.js";
import { RECIPES } from "../src/packs/space-r2.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const DEG = Math.PI / 180;

test.describe("Space r3: the real worlds zoom in and name the place", () => {
  test("Natural Earth names known spots on Earth", async () => {
    const e = await loadPlaces("earth");
    const paris = e.at(48.857, 2.352);
    expect(paris.title).toBe("Paris");
    expect(paris.country).toBe("France");
    const everest = e.at(27.988, 86.925);
    expect(everest.title).toBe("Mount Everest");
    expect(everest.lines.join(" ")).toContain("Himalayas");
    const denver = e.at(39.74, -104.99);
    expect(denver.title).toBe("Denver");
    expect(denver.state).toBe("Colorado");
    expect(denver.country).toBe("United States");
    expect(e.at(-33.87, 151.21).state).toBe("New South Wales");
    expect(e.at(30, -40).title).toBe("Atlantic Ocean");
    expect(e.at(35.68, 139.69).title).toBe("Tokyo");
    expect(e.source).toMatch(/Natural Earth/);
  });

  test("the Gazetteer names known features on the Moon, Mars, Mercury and Venus", async () => {
    const at = async (w, lat, lon) => (await loadPlaces(w, worldById(w).radiusKm)).at(lat, lon);
    const tycho = await at("moon", -43.3, -11.22);
    expect(tycho.title).toBe("Tycho");
    expect(tycho.lines[0]).toMatch(/crater, 85 km across/);
    const olympus = await at("mars", 18.65, -133.8);
    expect([olympus.title, ...olympus.lines].join(" ")).toContain("Olympus Mons");
    expect((await at("mars", 17, -131)).title).toBe("Olympus Mons");
    expect((await at("mars", -5.37, 137.81)).lines.join(" ")).toContain("Gale");
    expect((await at("mercury", 27.66, 57.37)).title).toBe("Rachmaninoff");
    expect((await at("venus", 0.5, -165.4)).title).toBe("Maat Mons");
    expect((await at("moon", 0.67, 23.47)).lines.join(" ")).toContain("Mare Tranquillitatis");
    for (const w of ["io", "europa", "ganymede", "callisto", "titan", "pluto", "ceres", "vesta"])
      expect((await at(w, 0, 0)).title.length, w).toBeGreaterThan(0);
  });

  test("each world's close-up tiles are where its global map says, and finer", async () => {
    test.setTimeout(240_000);
    for (const id of Object.keys(TILES)) {
      const W = await loadWorld(id, { patches: false });
      const f = (W.def.features || [])[0];
      const z = await loadZoom(id, f.lat, f.lon, 4);
      expect(z.tiles, id).toBeGreaterThan(0);
      expect(z.texel, id).toBeLessThan(0.25 * DEG);
      // The tile's color, averaged over a few degrees, matches the global
      // map's there (the same place, not a shifted one).
      let a = [0, 0, 0];
      let b = [0, 0, 0];
      let n = 0;
      for (let i = -4; i <= 4; i++)
        for (let j = -4; j <= 4; j++) {
          const lat = f.lat + i * 0.4;
          const lon = f.lon + (j * 0.4) / Math.max(0.3, Math.cos(f.lat * DEG));
          const zc = z.color(lat, lon);
          if (!zc) continue;
          const gc = W.color(lat, lon);
          for (let k = 0; k < 3; k++) ((a[k] += zc[k]), (b[k] += gc[k]));
          n++;
        }
      expect(n, id).toBeGreaterThan(40);
      a = a.map((v) => v / n);
      b = b.map((v) => v / n);
      // (Venus's and Mercury's global maps are stretched a little differently.)
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k]), `${id} ${k}`).toBeLessThan(0.12);
      if (z.hasHeight && W.def.maps.height) {
        const zh = z.height(f.lat, f.lon);
        const gh = W.height(f.lat, f.lon);
        // Earth's tiles keep the sea at 0; elsewhere the two agree within the global map's blur.
        expect(Math.abs(zh - (id === "earth" ? Math.max(0, gh) : gh)), id).toBeLessThan(3000);
      }
    }
  });

  test("the tiles and names are small enough, and each world lists its tiles", () => {
    for (const [id, t] of Object.entries(TILES)) {
      const j = JSON.parse(fs.readFileSync(`assets/toys/${t.toy}/tiles/${id}-tiles.json`, "utf8"));
      expect(j.color.length, id).toBeGreaterThan(300);
      if (id !== "earth") expect(fs.existsSync(`assets/toys/${t.toy}/names-${id}.json`), id).toBe(true); // prettier-ignore
    }
    expect(fs.statSync("assets/toys/real-earth/places.bin").size).toBeLessThan(2_000_000);
    expect(fs.statSync("assets/toys/real-earth/places.json").size).toBeLessThan(1_000_000);
  });

  test("each world's recipe says what a tap does and credits its names", () => {
    for (const id of [
      "real-earth",
      "real-moon",
      "real-mars",
      "real-mercury",
      "real-venus",
      "real-moons",
      "real-small-worlds",
    ]) {
      // prettier-ignore
      const r = RECIPES[id];
      expect(r.action.at, id).toBeTruthy();
      expect(r.note, id).toMatch(/zooms in/);
      expect(
        r.credits.some((c) => /Natural Earth|Gazetteer/.test(c.title)),
        id,
      ).toBe(true);
      expect(r.options.find((o) => o.key === "at")?.hidden, id).toBe(true);
    }
  });

  // A tap on the screen where a known spot shows zooms in on it and names it.
  for (const [id, world, lat, lon, check] of [
    ["real-earth", "earth", 48.857, 2.352, (p) => p.city === "Paris" && p.country === "France"],
    ["real-earth", "earth", 27.988, 86.925, (p) => p.title === "Mount Everest"],
    ["real-moon", "moon", -43.3, -11.22, (p) => p.title === "Tycho"],
    ["real-mars", "mars", 18.65, -133.8, (p) => [p.title, ...p.lines].join(" ").includes("Olympus Mons")], // prettier-ignore
  ])
    test(`a tap on ${id} at ${lat}, ${lon} zooms in and names it`, async ({ browser }) => {
      test.setTimeout(300_000);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      const said = [];
      await page.exposeFunction("__said", (m) => said.push(m));
      // Facing the spot, standing still.
      await page.evaluate(
        async ([world, lon]) => {
          const m = await import("/src/packs/space-r2.js");
          m.zoomState(world).spin = -lon * (Math.PI / 180);
          window.__splashery.player.on("say", (s) => window.__said(s));
        },
        [world, lon],
      );
      await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
      await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.kit?.data, id, { timeout: 120_000 }); // prettier-ignore
      await page.evaluate(
        async ([world, lon]) => {
          const m = await import("/src/packs/space-r2.js");
          m.zoomState(world).spin = -lon * (Math.PI / 180);
          await window.__splashery.app.setToyOptions({ turn: "still" });
        },
        [world, lon],
      );
      await page.waitForFunction((id) => window.__splashery.player.proc?.ctx?.kit?.data?.turn === "still", id, { timeout: 120_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      // Where the spot shows now.
      const xy = await page.evaluate(
        async ([world, lat, lon]) => {
          const m = await import("/src/packs/space-r2.js");
          const q = m.zoomState(world).q;
          const d = m.dirOf(lat, lon);
          const [x, y, z, w] = q;
          const cx = y * d[2] - z * d[1] + w * d[0];
          const cy = z * d[0] - x * d[2] + w * d[1];
          const cz = x * d[1] - y * d[0] + w * d[2];
          const v = [d[0] + 2 * (y * cz - z * cy), d[1] + 2 * (z * cx - x * cz), d[2] + 2 * (x * cy - y * cx)]; // prettier-ignore
          const p = window.__splashery.player;
          const s = p.screenPoint(v);
          const r = p.canvas.getBoundingClientRect();
          return [r.x + s[0], r.y + s[1], v[2]];
        },
        [world, lat, lon],
      );
      expect(xy[2]).toBeGreaterThan(0.4);
      await page.mouse.click(xy[0], xy[1]);
      // It turns, rebuilds with the patch round the spot, and zooms in.
      await page.waitForFunction((w) => window.__splashery.player.proc?.ctx?.kit?.data?.at && window.__splashery.player.motion.out?.body?.squash > 1, world, { timeout: 120_000 }); // prettier-ignore
      const z = await page.evaluate(async (w) => {
        const m = await import("/src/packs/space-r2.js");
        const s = m.zoomState(w);
        return { lat: s.lat, lon: s.lon, place: s.place, phase: s.phase };
      }, world);
      expect(z.phase).toBe("in");
      // The tap's spot is within a few kilometers' worth of the screen of the spot.
      expect(Math.abs(z.lat - lat)).toBeLessThan(1.5);
      expect(check(z.place), JSON.stringify(z.place)).toBe(true);
      expect(said.join(" ")).toContain(z.place.title);
      await page.screenshot({ path: `tests/screenshots/sp3-${world}-zoom-1440x900.png` });
      // A second tap goes back out.
      await page.mouse.click(720, 450);
      await page.waitForFunction((w) => window.__splashery.player.motion.out?.body?.squash === 0, world, { timeout: 120_000 }); // prettier-ignore
      expect(errors).toEqual([]);
      await page.close();
    });
});
