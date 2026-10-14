// Lane Space r4: the solar system on real orbits. The orbits are checked
// against JPL Horizons (positions recorded below on October 7, 2026, from
// https://ssd.jpl.nasa.gov/api/horizons.api: heliocentric, or planet-centered
// for the moons, J2000 ecliptic, au, at 0h TDB), the GPU program's Kepler
// step against the CPU's, the asteroid snapshot against the catalog it
// samples, and the toy in the browser (labs on).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import * as K from "../src/space/kepler.js";
import {
  RECIPES,
  placesAt,
  daysPerSecond,
  dateText,
  DATE_MIN,
  DATE_MAX,
} from "../src/packs/space-r4.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";
import { packNormal, unpackNormal } from "../src/space/field.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const DATA = JSON.parse(fs.readFileSync(new URL("../assets/toys/solar-orbits/orbits.json", import.meta.url), "utf8")); // prettier-ignore
const jd = (d) => K.julianDay(Date.parse(`${d}T00:00:00Z`));
const angle = (a, b) => {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b);
  return (Math.acos(Math.min(1, d)) * 180) / Math.PI;
};
const ratio = (a, b) => Math.abs(Math.hypot(...a) / Math.hypot(...b) - 1);

// JPL Horizons, recorded October 7, 2026 (tools/sp4-orbits.mjs --horizons).
// "emb" is the Earth-Moon barycenter (Horizons body 3).
const HORIZONS = {
  planets: {
    mercury: {
      "1850-01-01": [0.2568, -0.337277, -0.051155],
      "1950-06-15": [0.334957, -0.209629, -0.047897],
      "2000-01-01": [-0.140728, -0.443901, -0.023346],
      "2026-10-07": [0.111798, -0.437463, -0.046005],
      "2049-12-31": [-0.149726, 0.281198, 0.036712],
    },
    venus: {
      "1850-01-01": [-0.276611, -0.670634, 0.007112],
      "1950-06-15": [0.707335, -0.163735, -0.04307],
      "2000-01-01": [-0.71863, -0.022504, 0.041172],
      "2026-10-07": [0.724183, 0.038276, -0.041258],
      "2049-12-31": [0.122028, -0.716983, -0.016936],
    },
    emb: {
      "1850-01-01": [-0.210998, 0.96035, 0.000321],
      "1950-06-15": [-0.105651, -1.0103, -0.000116],
      "2000-01-01": [-0.16855, 0.968764, -1e-6],
      "2026-10-07": [0.972509, 0.231258, -2e-5],
      "2049-12-31": [-0.154337, 0.971185, -0.000109],
    },
    mars: {
      "1850-01-01": [-0.141007, 1.577032, 0.036468],
      "1950-06-15": [-1.171921, -1.045247, 0.007049],
      "2000-01-01": [1.390361, -0.02101, -0.034618],
      "2026-10-07": [0.046619, 1.564589, 0.031645],
      "2049-12-31": [-1.54804, -0.491467, 0.027574],
    },
    jupiter: {
      "1850-01-01": [-5.236953, 1.390861, 0.111997],
      "1950-06-15": [4.199796, -2.757288, -0.082788],
      "2000-01-01": [4.00346, 2.935353, -0.101823],
      "2026-10-07": [-3.524981, 3.969258, 0.062378],
      "2049-12-31": [-2.384226, 4.667166, 0.0338],
    },
    saturn: {
      "1850-01-01": [9.295728, 1.619518, -0.396888],
      "1950-06-15": [-9.257598, 1.601302, 0.339695],
      "2000-01-01": [6.408556, 6.568043, -0.369127],
      "2026-10-07": [9.250968, 1.799486, -0.399584],
      "2049-12-31": [4.761632, -8.776367, -0.037648],
    },
    uranus: {
      "1850-01-01": [17.702018, 9.094915, -0.196404],
      "1950-06-15": [-1.892409, 18.821142, 0.094614],
      "2000-01-01": [14.430516, -13.73566, -0.238129],
      "2026-10-07": [8.909556, 17.278252, -0.051353],
      "2049-12-31": [-17.822327, 4.075477, 0.245853],
    },
    neptune: {
      "1850-01-01": [27.440436, -12.058673, -0.383828],
      "1950-06-15": [-28.946937, -8.901505, 0.850181],
      "2000-01-01": [16.810758, -24.992651, 0.127271],
      "2026-10-07": [29.836536, 1.399064, -0.716385],
      "2049-12-31": [17.400777, 24.195933, -0.899263],
    },
  },
  small: {
    ceres: {
      "2000-01-01": [-2.37753, 0.800777, 0.462838],
      "2026-10-07": [0.218226, 2.659508, 0.043993],
      "2045-03-20": [0.08546, 2.663128, 0.071685],
    },
    vesta: {
      "2000-01-01": [-1.358388, -1.669429, 0.215374],
      "2026-10-07": [2.32391, 0.754929, -0.305388],
      "2045-03-20": [1.790151, 1.782834, -0.270215],
    },
    halley: {
      "1986-02-09": [0.342334, -0.446593, 0.167797],
      "1950-06-15": [-19.447351, 27.584969, -9.909604],
      "2000-01-01": [-17.38539, 16.97808, -7.577641],
    },
    encke: {
      "2023-10-22": [-0.314366, 0.12918, -0.004329],
      "2026-10-07": [2.002085, 0.534771, 0.27249],
    },
    "67p": {
      "2015-08-13": [0.568846, 1.104981, 0.033546],
      "2026-10-07": [-0.01695, -4.485848, -0.243675],
    },
  },
  moons: {
    moon: {
      "1900-01-01": [0.0001635379676047432, -0.002456645658319611, 4.70766255789861e-5],
      "1950-06-15": [0.0006205389126663373, 0.002611429160965112, 0.0002237837282433175],
      "2000-01-02": [-0.001752483887566555, -0.002038339499137031, 0.0002377375616078035],
      "2010-03-03": [-0.002365143139927305, -0.0006008145262737174, -0.0002173167309120909],
      "2026-10-07": [-0.002130274155352272, 0.001332699643934911, 2.961780741192111e-6],
      "2049-12-31": [0.002487270863780582, 0.0001867451612979475, 0.0001840277766141394],
    },
    io: {
      "1900-01-01": [-0.001166912885705883, -0.00257682783328701, -0.000109638916632983],
      "1950-06-15": [-0.002811043163101579, 0.0001390307943865907, -3.455857315804414e-5],
      "2000-01-02": [-0.001424213240549982, 0.002428468619191101, 6.464268721249127e-5],
      "2010-03-03": [0.002340365856057807, 0.001586938865705455, 8.90025466285856e-5],
      "2026-10-07": [-0.0020254722478964, -0.001973638187331036, -0.0001003773982821583],
      "2049-12-31": [-0.001028790296108427, 0.002628179268763135, 8.071605714754003e-5],
    },
    europa: {
      "1900-01-01": [-0.003901815538622099, 0.00220945312110822, 1.224877725407345e-6],
      "1950-06-15": [-0.003613834299756183, 0.00271330281916593, 8.026538703901938e-5],
      "2000-01-02": [-0.0004633263465417191, -0.004425527353941768, -0.0001295583675904155],
      "2010-03-03": [-0.001455257992777825, 0.004254791676466656, 0.0001596364807721433],
      "2026-10-07": [-0.002256096829841468, 0.003865945365464934, 7.101861550929484e-5],
      "2049-12-31": [0.004335794557817722, -0.001052050633990602, 5.059753160062767e-5],
    },
    ganymede: {
      "1900-01-01": [-0.006939618069423149, -0.001787823755886949, -0.0001718898707376101],
      "1950-06-15": [0.005712147810191086, 0.004299383473599431, 0.0002190750799056383],
      "2000-01-02": [-0.003015499462445574, -0.006477504269597137, -0.0002734695226863535],
      "2010-03-03": [-0.004168710307253542, -0.005800263619477474, -0.0002707267824959027],
      "2026-10-07": [0.006694693981693605, -0.002470955970295318, 3.429769617476292e-6],
      "2049-12-31": [0.006899095309324561, 0.001843864384374338, 0.0001830276647797143],
    },
    callisto: {
      "1900-01-01": [-0.005070468938001254, -0.01143065514946508, -0.000430235462183352],
      "1950-06-15": [0.005560932500553041, -0.0111856750491338, -0.000330921293470893],
      "2000-01-02": [-0.0001829504185829665, 0.01258781511872435, 0.0004084309543566378],
      "2010-03-03": [-0.001628267667507482, -0.0124841749474084, -0.0004233986911100302],
      "2026-10-07": [0.01217581814698598, -0.002841768031425715, 7.48683117514822e-5],
      "2049-12-31": [-0.01187673657103682, 0.00434645827085998, -2.60363505643906e-5],
    },
    titan: {
      "1900-01-01": [0.002131334510520736, -0.006867322626693182, 0.003344684792575659],
      "1950-06-15": [-0.007256842539030178, 0.003978665265590479, -0.001361955278716956],
      "2000-01-02": [-0.007238554620294411, 0.004036194041169187, -0.001373294962192377],
      "2010-03-03": [-0.001539855940108236, 0.007292279006000184, -0.00361222817080354],
      "2026-10-07": [-0.007864248367867928, 0.002867257577830595, -0.0006961498784268665],
      "2049-12-31": [-0.005824991153091543, -0.005036392888794938, 0.00317675541915123],
    },
  },
};

async function build(options = {}, count = 160000) {
  const recipe = RECIPES["solar-orbits"];
  const o = resolveOptions(recipe, options);
  await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test.describe("sp4 orbits against JPL Horizons", () => {
  test("the planets, 1850 to 2049, within 0.2 degrees and 0.2% of the distance", () => {
    const ids = { emb: "earth" };
    let worst = 0;
    for (const [name, dates] of Object.entries(HORIZONS.planets))
      for (const [d, v] of Object.entries(dates)) {
        const p = K.planetPos(ids[name] || name, jd(d));
        const a = angle(p, v);
        worst = Math.max(worst, a);
        expect(a, `${name} ${d}`).toBeLessThan(0.2);
        expect(ratio(p, v), `${name} ${d}`).toBeLessThan(0.002);
      }
    // (Saturn is the worst: Table 1 leaves out Jupiter's and Saturn's pull on each other.)
    expect(worst).toBeGreaterThan(0.1);
  });

  test("asteroids and comets by the two-body problem: close near the epoch, drifting slowly", () => {
    const ast = (n) => K.asteroidOrbit(DATA.asteroids.list.find((r) => r[0] === n), DATA.asteroids.epochJD); // prettier-ignore
    const comet = (id) => DATA.comets.find((c) => c.id === id);
    const check = (el, name, d, deg) => {
      const v = HORIZONS.small[name][d];
      expect(angle(K.keplerPos(el, jd(d)), v), `${name} ${d}`).toBeLessThan(deg);
    };
    // Near the snapshot's epoch (2026): within a hundredth of a degree.
    check(ast(1), "ceres", "2026-10-07", 0.01);
    check(ast(4), "vesta", "2026-10-07", 0.01);
    // A quarter century away, the planets' pulls (left out) add up to a degree or two.
    check(ast(1), "ceres", "2000-01-01", 2.5);
    check(ast(1), "ceres", "2045-03-20", 2.5);
    check(ast(4), "vesta", "2000-01-01", 2.5);
    check(comet("67p"), "67p", "2015-08-13", 0.01);
    check(comet("encke"), "encke", "2023-10-22", 0.05);
    // Halley at its 1986 perihelion, from its 1968 solution: within 4 degrees
    // (near the Sun it moves fast, so a day's error is a few degrees).
    check(comet("halley"), "halley", "1986-02-09", 4);
    check(comet("halley"), "halley", "1950-06-15", 0.5);
  });

  test("the moons, 1900 to 2049, within 6 degrees of Horizons", () => {
    const tol = { moon: 6, io: 3, europa: 6.5, ganymede: 0.5, callisto: 0.5, titan: 3.5 };
    for (const [id, dates] of Object.entries(HORIZONS.moons)) {
      const m = DATA.moons.find((x) => x.id === id);
      for (const [d, v] of Object.entries(dates)) {
        const p = K.moonOffset(m, jd(d));
        expect(angle(p, v), `${id} ${d}`).toBeLessThan(tol[id]);
        expect(ratio(p, v), `${id} ${d}`).toBeLessThan(0.08);
      }
    }
  });
});

test.describe("sp4 the GPU program's Kepler step", () => {
  test("carries an asteroid as the CPU does, from its stored place, a and velocity direction", () => {
    const f32 = new Float32Array(1);
    const r32 = (x) => ((f32[0] = x), f32[0]);
    const epoch = DATA.asteroids.epochJD;
    let worst = 0;
    for (const row of DATA.asteroids.list.filter((_, i) => i % 97 === 0)) {
      const el = K.asteroidOrbit(row, epoch);
      const s = K.keplerState(el, epoch);
      const sp = Math.hypot(...s.v);
      // As stored: float32 place and a, the direction packed in two 12-bit numbers.
      const toy = [s.v[0] / sp, s.v[2] / sp, -s.v[1] / sp];
      const n = unpackNormal(packNormal(toy));
      const vdir = [n[0], -n[2], n[1]];
      for (const dt of [-82000, -9000, 0, 8500]) {
        const a = K.propagateStored(s.p.map(r32), r32(el.a), vdir, dt);
        const b = K.keplerPos(el, epoch + dt);
        worst = Math.max(worst, angle(a, b));
      }
    }
    // 12-bit directions cost a little: well under a degree after two centuries.
    expect(worst).toBeLessThan(1);
  });
});

test.describe("sp4 the snapshot and the build", () => {
  test("the asteroids are a fair sample of the numbered ones", () => {
    const A = DATA.asteroids;
    expect(A.list.length).toBeGreaterThanOrEqual(4000);
    expect(A.total).toBeGreaterThan(800000);
    // Main-belt asteroids are about 92% of the pool (SBDB classes MBA, IMB, OMB).
    const belt = (A.classes.MBA + A.classes.IMB + A.classes.OMB) / A.list.length;
    expect(belt).toBeGreaterThan(0.9);
    expect(belt).toBeLessThan(0.99);
    // The Kirkwood gap at the 3:1 resonance with Jupiter (2.50 au) is nearly empty.
    const near = (lo, hi) => A.list.filter((r) => r[1] > lo && r[1] < hi).length;
    expect(near(2.495, 2.51)).toBeLessThan(near(2.43, 2.445) / 4);
    // The Trojans cluster 60 degrees ahead of and behind Jupiter.
    const J = K.planetPos("jupiter", A.epochJD);
    const lj = Math.atan2(J[1], J[0]);
    const tro = A.list
      .filter((r) => r[1] > 5.05 && r[1] < 5.35)
      .map((r) => {
        const p = K.keplerPos(K.asteroidOrbit(r, A.epochJD), A.epochJD);
        const d = ((Math.atan2(p[1], p[0]) - lj) * 180) / Math.PI;
        return ((d + 540) % 360) - 180;
      });
    expect(tro.length).toBeGreaterThan(20);
    const lead = tro.filter((d) => d > 30 && d < 100).length;
    const trail = tro.filter((d) => d < -30 && d > -100).length;
    expect(lead + trail).toBeGreaterThan(tro.length * 0.85);
  });

  test("builds on both scales; the drive puts each planet where Kepler says", async () => {
    for (const scale of ["readable", "true"]) {
      const ctx = await build({ scale });
      const d = ctx.kit.data;
      expect(d.bodies.filter((b) => b.kind === 0).length).toBe(8);
      expect(d.asteroids).toBeGreaterThanOrEqual(4000);
      expect(ctx.buf.count).toBeLessThan(150000);
      const when = jd("2031-05-01");
      const now = placesAt(d.bodies, scale, when);
      const sc = K.SCALES[scale];
      for (const [i, b] of d.bodies.entries())
        if (b.kind === 0) {
          const want = K.drawn(K.planetPos(b.id, when), sc);
          expect(Math.hypot(...now[i].map((x, k) => x - want[k]))).toBeLessThan(1e-9);
        }
      // The drive: the same places as token offsets from where they were built.
      const out = { parts: {}, tokens: null };
      const c = { speed: 0, fly: 0 };
      RECIPES["solar-orbits"].drive(0, c, out, { data: { ...d, startJd: when } });
      const jup = d.bodies.findIndex((b) => b.id === "jupiter");
      const p = out.tokens[jup].offset.map((x, k) => x + d.bodies[jup].built[k]);
      expect(Math.hypot(...p.map((x, k) => x - now[jup][k]))).toBeLessThan(1e-9);
      expect(out.legend.title).toBe("May 1, 2031");
    }
  });

  test("speed runs from paused to a year a second; dates 1800 to 2050", () => {
    expect(daysPerSecond(0)).toBe(0);
    expect(daysPerSecond(1)).toBeCloseTo(365.25, 6);
    expect(daysPerSecond(0.03)).toBeLessThan(0.05);
    expect(dateText(DATE_MIN)).toBe("January 1, 1800");
    expect(dateText(DATE_MAX)).toBe("December 31, 2050");
  });

  test("is a labs toy with a sound, help and credits", () => {
    const toy = TOYS.find((t) => t.id === "solar-orbits");
    expect(toy.labs).toBe(true);
    expect(TOY_SOUNDS["solar-orbits"]).toBeTruthy();
    expect(TOY_HELP["solar-orbits"].about.length).toBeGreaterThan(200);
    expect(RECIPES["solar-orbits"].credits.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe("sp4 in the browser", () => {
  test.setTimeout(240_000);
  test("draws, takes a date from the slider and flies to Mercury", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("solar-orbits"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.tour, null, { timeout: 120_000 }); // prettier-ignore
    // The GPU program compiled and drew: the toy covers part of the stage.
    await page.waitForTimeout(800);
    // Paused, then January 1, 2000 from the slider.
    await page.evaluate(() => window.__splashery.app.setControl("speed", 0));
    const v = (K.julianDay(Date.UTC(2000, 0, 1)) - DATE_MIN) / (DATE_MAX - DATE_MIN);
    await page.evaluate((x) => window.__splashery.player.sliderInput(window.__splashery.player.motion.out.slider.id, x), v); // prettier-ignore
    await expect.poll(() => page.evaluate(() => window.__splashery.player.motion.out?.legend?.title), { timeout: 20_000 }).toMatch(/2000|1999/); // prettier-ignore
    const shot = await page.screenshot();
    expect(shot.length).toBeGreaterThan(20000);
    await page.evaluate(() => window.__splashery.app.act());
    await expect.poll(() => page.evaluate(() => window.__splashery.player.motion.out?.legend?.items?.some((i) => i.on && i.text.startsWith("Mercury"))), { timeout: 30_000 }).toBe(true); // prettier-ignore
    await expect.poll(() => page.evaluate(() => window.__splashery.player.motion.out?.glow?.[0]), { timeout: 60_000 }).toBeGreaterThan(5); // prettier-ignore
  });
});
