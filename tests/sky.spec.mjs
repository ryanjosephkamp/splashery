// Lane Night sky (docs/handoff/NightSky.md, docs/evidence/night-sky.json): the sky math against
// published values, and the toy in the app (the view from inside, a tap that names a star, the
// location kept on the device).
//
// The reference values are recorded here; the test never calls a server. Planet, Sun and Moon
// positions came from JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api) on October 5, 2026, with
// tools/sky-horizons.mjs: geocentric astrometric RA and Dec (ICRF, degrees), and the apparent
// azimuth and elevation (airless) and the Moon's illuminated percentage seen from two places.
// The star altitudes came from Astropy 8.0.1 (FK5 J2000 to AltAz, no refraction) for the same
// J2000 positions the catalog carries.

import { test, expect } from "@playwright/test";
import * as A from "../src/sky/astro.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const ms = (utc) => Date.parse(utc.replace(" ", "T") + ":00Z");
const sep = (ra1, dec1, ra2, dec2) => {
  const a = A.fromRaDec(ra1, dec1);
  const b = A.fromRaDec(ra2, dec2);
  return (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
};
// Opens the toy, sets a place and time and waits for a frame that shows them, with the view
// settled at the toy's home (headless frames are slow).
async function openSky(page, set) {
  await page.evaluate(async () => {
    const S = window.__splashery;
    if (S.player.scene.toy.id !== "night-sky") await S.app.chooseToy("night-sky");
  });
  const want = Date.parse(set.time);
  await page.evaluate((set) => window.__splashery.sky.set(set), set);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.sky.state().drawn), { timeout: 60_000 })
    .toBe(want);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = window.__splashery.player.camera;
          return Math.abs(c.cur.yaw - c.home.yaw) + Math.abs(c.cur.pitch - c.home.pitch) < 1e-3;
        }),
      { timeout: 60_000 },
    )
    .toBe(true);
}

const azDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// [body, UTC, RA, Dec] from Horizons (geocentric, astrometric J2000).
const GEOCENTRIC = [
  ["sun", "1990-06-15 00:00", 83.23354, 23.29483],
  ["moon", "1990-06-15 00:00", 339.46499, -5.80911],
  ["mercury", "1990-06-15 00:00", 63.36517, 19.40419],
  ["venus", "1990-06-15 00:00", 46.42558, 15.40566],
  ["mars", "1990-06-15 00:00", 10.71674, 2.45564],
  ["jupiter", "1990-06-15 00:00", 107.28963, 22.67512],
  ["saturn", "1990-06-15 00:00", 296.06093, -21.16156],
  ["uranus", "1990-06-15 00:00", 279.06664, -23.50304],
  ["neptune", "1990-06-15 00:00", 284.94847, -21.84815],
  ["sun", "2000-01-01 12:00", 281.28898, -23.03325],
  ["moon", "2000-01-01 12:00", 222.45893, -10.90338],
  ["mercury", "2000-01-01 12:00", 272.08522, -24.42038],
  ["venus", "2000-01-01 12:00", 239.90118, -18.45185],
  ["mars", "2000-01-01 12:00", 330.5246, -13.1805],
  ["jupiter", "2000-01-01 12:00", 23.86983, 8.5959],
  ["saturn", "2000-01-01 12:00", 38.766, 12.61628],
  ["uranus", "2000-01-01 12:00", 317.48381, -17.01884],
  ["neptune", "2000-01-01 12:00", 305.44265, -19.21243],
  ["sun", "2026-10-05 00:00", 190.48524, -4.51004],
  ["moon", "2026-10-05 00:00", 123.02607, 22.49972],
  ["mercury", "2026-10-05 00:00", 212.37294, -15.40886],
  ["venus", "2026-10-05 00:00", 213.15257, -21.14837],
  ["mars", "2026-10-05 00:00", 126.21023, 20.39389],
  ["jupiter", "2026-10-05 00:00", 142.53158, 15.41325],
  ["saturn", "2026-10-05 00:00", 11.06683, 1.80838],
  ["uranus", "2026-10-05 00:00", 63.16577, 20.99068],
  ["neptune", "2026-10-05 00:00", 2.73956, -0.36095],
  ["sun", "2045-03-20 06:00", 359.45685, -0.2358],
  ["moon", "2045-03-20 06:00", 14.44104, 10.2586],
  ["mercury", "2045-03-20 06:00", 357.76697, 2.64973],
  ["venus", "2045-03-20 06:00", 0.31358, -1.38094],
  ["mars", "2045-03-20 06:00", 8.76978, 3.13106],
  ["jupiter", "2045-03-20 06:00", 330.50282, -12.84307],
  ["saturn", "2045-03-20 06:00", 249.87039, -20.22036],
  ["uranus", "2045-03-20 06:00", 145.40623, 14.63476],
  ["neptune", "2045-03-20 06:00", 40.42352, 13.88953],
];

// [place, latitude, longitude, body, UTC, elevation, azimuth, illuminated %] from Horizons.
const TOPOCENTRIC = [
  ["Greenwich", 51.4769, -0.0015, "sun", "2026-10-05 00:00", -43.119764, 3.904989, 100],
  ["Greenwich", 51.4769, -0.0015, "moon", "2026-10-05 00:00", 4.990207, 61.025128, 33.34368],
  ["Greenwich", 51.4769, -0.0015, "jupiter", "2026-10-05 00:00", -9.986518, 49.363162, 99.45328],
  ["Greenwich", 51.4769, -0.0015, "sun", "2045-03-20 06:00", -1.14458, 88.54165, 100],
  ["Greenwich", 51.4769, -0.0015, "moon", "2045-03-20 06:00", -2.933089, 70.322585, 2.54156],
  ["Greenwich", 51.4769, -0.0015, "jupiter", "2045-03-20 06:00", 6.061736, 119.09869, 99.73562],
  ["New York", 40.7128, -74.006, "sun", "2026-10-05 00:00", -17.28498, 278.951271, 100],
  ["New York", 40.7128, -74.006, "moon", "2026-10-05 00:00", -27.639455, 356.127385, 33.83144],
  ["New York", 40.7128, -74.006, "jupiter", "2026-10-05 00:00", -29.990399, 333.957644, 99.45332],
  ["New York", 40.7128, -74.006, "sun", "2045-03-20 06:00", -47.295952, 21.116746, 100],
  ["New York", 40.7128, -74.006, "moon", "2045-03-20 06:00", -39.499106, 358.924906, 2.41437],
  ["New York", 40.7128, -74.006, "jupiter", "2045-03-20 06:00", -43.072575, 65.811935, 99.73562],
];

// How close each must come (degrees). JPL gives Table 1's own errors (heliocentric) as up to
// about 0.1 to 0.6 arcminutes for the inner planets and a few arcminutes for Jupiter and Saturn,
// whose mutual pull it leaves out; the Almanac's lunar series is good to about 0.3 degrees.
const TOLERANCE = { sun: 0.02, mercury: 0.02, venus: 0.02, mars: 0.03, jupiter: 0.2, saturn: 0.25, uranus: 0.05, neptune: 0.05, moon: 0.3 }; // prettier-ignore

test("the Sun, the Moon and the planets match JPL Horizons on four dates", () => {
  for (const [body, utc, ra, dec] of GEOCENTRIC) {
    const jd = A.julianDay(ms(utc));
    let got;
    if (body === "moon") {
      // The series gives the equator of the date; Horizons gives J2000.
      const P = A.precession(jd);
      const back = [P[0], P[3], P[6], P[1], P[4], P[7], P[2], P[5], P[8]];
      got = A.toRaDec(A.mulMV(back, A.moonGeocentric(jd).eq));
    } else got = A.toRaDec(A.planet(body, jd).eq);
    const d = sep(ra, dec, got.ra, got.dec);
    expect(d, `${body} at ${utc}: ${d.toFixed(3)} degrees off`).toBeLessThan(TOLERANCE[body]);
  }
});

test("seen from Greenwich and New York, altitude, azimuth and the Moon's phase match Horizons", () => {
  for (const [place, lat, lon, body, utc, alt, az, illum] of TOPOCENTRIC) {
    const b = A.sky(ms(utc), lat, lon).bodies[body];
    const tol = body === "moon" ? 0.3 : body === "jupiter" ? 0.2 : 0.02;
    expect(Math.abs(b.alt - alt), `${body} from ${place} at ${utc}: altitude`).toBeLessThan(tol);
    // Azimuth is loose near the zenith; none of these is higher than 45 degrees.
    expect(azDiff(b.az, az), `${body} from ${place} at ${utc}: azimuth`).toBeLessThan(tol * 1.5);
    if (body === "moon") expect(Math.abs(b.illum * 100 - illum)).toBeLessThan(1);
  }
});

test("Greenwich sidereal time matches Meeus' worked examples 12.a and 12.b", () => {
  // 1987 April 10, 0h UT: 13h 10m 46.3668s. 19h 21m 00s UT: 128.7378734 degrees.
  expect(A.gmst(2446895.5)).toBeCloseTo(((13 + 10 / 60 + 46.3668 / 3600) * 15) % 360, 5);
  expect(A.gmst(2446895.5 + (19 + 21 / 60) / 24)).toBeCloseTo(128.7378734, 5);
  // Local sidereal time adds the east longitude.
  expect(A.lst(2446895.5, -74.006)).toBeCloseTo((197.693195 - 74.006 + 360) % 360, 4);
});

test("stars' altitude and azimuth match Astropy for known places and times", () => {
  // [name, RA, Dec (J2000), latitude, longitude, UTC, altitude, azimuth]
  const STARS = [
    ["Vega", 279.2347, 38.7837, 51.4769, -0.0015, "2026-10-05 00:00", 27.038, 299.2546],
    ["Sirius", 101.2872, -16.7161, 40.7128, -74.006, "2026-01-15 04:00", 32.5361, 178.9036],
    ["Polaris", 37.9546, 89.2641, 40.7128, -74.006, "2026-10-05 00:00", 40.5231, 0.786],
    ["Acrux", 186.6496, -63.0991, -33.8688, 151.2093, "2026-05-01 12:00", 60.5331, 183.3066],
  ];
  for (const [name, ra, dec, lat, lon, utc, alt, az] of STARS) {
    const got = A.starAltAz(ra, dec, ms(utc), lat, lon);
    expect(Math.abs(got.alt - alt), `${name} altitude`).toBeLessThan(0.02);
    expect(azDiff(got.az, az), `${name} azimuth`).toBeLessThan(0.03);
  }
});

test("star colors run from blue-white to orange with B−V, through the Sun's 5,800 K", () => {
  expect(A.bvToKelvin(0.65)).toBeGreaterThan(5600);
  expect(A.bvToKelvin(0.65)).toBeLessThan(6000);
  const hot = A.kelvinToRgb(A.bvToKelvin(-0.2));
  const cool = A.kelvinToRgb(A.bvToKelvin(1.8));
  expect(hot[2]).toBeGreaterThan(hot[0]);
  expect(cool[0]).toBeGreaterThan(cool[2]);
});

test("the toy shows the sky from inside, and a tap on Vega names it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await openSky(page, { city: "new-york", time: "2026-10-06T01:00:00Z", speed: "0" });
  const st = await page.evaluate(() => {
    const S = window.__splashery;
    S.sky.look("Vega");
    return { inside: S.player.camera.inside, state: S.sky.state() };
  });
  expect(st.inside).toEqual({ fov: 72 });
  expect(st.state.place.name).toBe("New York");
  await page.waitForTimeout(2500);
  // Vega's place on the screen, through the stage camera (it stands at the center).
  const at = await page.evaluate(() => {
    const S = window.__splashery;
    const d = S.sky.dirOf("Vega");
    const cam = S.player.stage.cameraEntity.camera;
    const pc = S.player.stage.cameraEntity.getPosition().clone();
    pc.x += d[0] * 0.5;
    pc.y += d[1] * 0.5;
    pc.z += d[2] * 0.5;
    const sp = cam.worldToScreen(pc);
    const r = S.player.stage.canvas.getBoundingClientRect();
    return { x: sp.x + r.left, y: sp.y + r.top };
  });
  await page.mouse.click(at.x, at.y);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.sky.state().picked), { timeout: 10_000 })
    .toMatchObject({ kind: "star" });
  // The words beside the stage follow on the next frames (slow in a headless browser).
  await expect(page.locator("#toy-legend")).toContainText("Vega", { timeout: 30_000 });
  const legend = await page.locator("#toy-legend").innerText();
  expect(legend).toContain("Lyra");
  expect(legend).toMatch(/light-years away/);
  await page.screenshot({ path: "tests/screenshots/sky-vega-390x844.png" });
});

test("the daylight fades the stars out, and twilight lights its glow", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const read = async (utc) => {
    await openSky(page, { city: "london", time: utc, speed: "0" });
    return page.evaluate(() => ({
      sun: window.__splashery.sky.state().bodies.sun.alt,
      morph: window.__splashery.player.motion.out.morph.slice(0, 2),
    }));
  };
  const noon = await read("2026-06-21T12:00:00Z");
  const night = await read("2026-12-21T00:00:00Z");
  const dusk = await read("2026-03-20T18:30:00Z");
  expect(noon.sun).toBeGreaterThan(50);
  expect(noon.morph[0]).toBe(1);
  expect(night.morph).toEqual([0, 0]);
  expect(dusk.sun).toBeLessThan(0);
  expect(dusk.sun).toBeGreaterThan(-12);
  expect(dusk.morph[1]).toBeGreaterThan(0.3);
});

test("“Use my location” asks only when tapped, and the place stays on the device", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // The browser's own prompt, answered yes, with a made-up place (Quito).
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -0.1807, longitude: -78.4678 });
  const page = await context.newPage();
  const asked = [];
  await page.exposeFunction("__skyAsked", () => asked.push(Date.now()));
  await page.addInitScript(() => {
    const geo = navigator.geolocation;
    const get = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (...a) => {
      window.__skyAsked();
      return get(...a);
    };
  });
  const requests = [];
  page.on("request", (r) => requests.push(r.url() + " " + (r.postData() || "")));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("night-sky"));
  await page.waitForTimeout(800);
  expect(asked.length).toBe(0); // nothing is asked when the toy opens
  await page.evaluate(() => window.__splashery.ui?.openTab?.("toy"));
  await page.locator("#sky-locate").evaluate((b) => b.click());
  await expect.poll(() => page.evaluate(() => window.__splashery.sky.state().place.id)).toBe("me");
  expect(asked.length).toBe(1);
  const place = await page.evaluate(() => window.__splashery.sky.state().place);
  expect(place.lat).toBeCloseTo(-0.1807, 3);
  expect(place.lon).toBeCloseTo(-78.4678, 3);
  // Not in the link, the saved scene or any request.
  await page.waitForTimeout(800);
  const saved = await page.evaluate(() => location.href + JSON.stringify(localStorage) + JSON.stringify(window.__splashery.player.scene)); // prettier-ignore
  for (const s of [saved, ...requests]) {
    expect(s).not.toContain("-0.18");
    expect(s).not.toContain("78.46");
  }
  await context.close();
});

// Polish (October 5, 2026): a new speed eases in instead of jumping, and the stars keep their
// size on the screen as a pinch zooms in.
test("a new speed eases in, and the stars keep their size on screen when zoomed", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await openSky(page, { city: "new-york", time: "2026-10-06T01:00:00Z", speed: "0" });
  // The panel's speed choice (not the test hook, which is instant).
  await page.evaluate(() => {
    const sel = document.getElementById("sky-speed");
    sel.value = "3600";
    sel.dispatchEvent(new Event("change"));
  });
  const first = await page.evaluate(() => window.__splashery.sky.state());
  expect(first.target).toBe(3600);
  expect(first.rate).toBeLessThan(3600);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.sky.state().rate), { timeout: 60_000 })
    .toBe(3600);
  // A pinch to half the field of view halves the stars' splats (the part's visibility).
  const vis = await page.evaluate(async () => {
    const { player } = window.__splashery;
    player.camera.zoomBy(0.5);
    player.camera.cur = { ...player.camera.tgt };
    await new Promise((r) => setTimeout(r, 1500));
    return player.motion.out.parts.stars.visible;
  });
  expect(vis).toBeCloseTo(0.5, 1);
});
