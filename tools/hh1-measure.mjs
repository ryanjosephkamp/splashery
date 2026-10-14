#!/usr/bin/env node
// Lane Hands-on H1: measures each toy in Hands-on from its own hands block.
// Drops it from 3 toy radii (the bounce heights it reaches), then throws it
// sideways along the floor (how far it goes and when it rests), and prints
// one line per toy as JSON.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/hh1-measure.mjs <toy id> [...]

import { chromium } from "@playwright/test";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const ids = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  const out = await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    if (!player.handsOn.on) document.querySelector("#hands-toggle").click();
    const h = player.handsOn;
    h.ensure();
    const b = h.body;
    if (!b) return { id, mode: h.mode };
    const R = h.R();
    const home = b.home.pos.slice();
    const dt = 1 / 60;
    // The drop: peaks after each floor contact.
    b.pos[1] += 3 * R;
    h.moved = true;
    h.world.wake();
    const peaks = [];
    let last = b.pos[1];
    let up = false;
    let t = 0;
    for (; t < 8; t += dt) {
      player.update(dt);
      const y = b.pos[1];
      if (y > last) up = true;
      else if (up && y < last) {
        peaks.push(+((last - home[1]) / R).toFixed(3));
        up = false;
      }
      last = y;
      if (h.world.asleep) break;
    }
    const drop = { peaks: peaks.slice(0, 6), rest: +t.toFixed(2) };
    // ↺ and wait home.
    h.reset();
    for (let k = 0; k < 120; k++) player.update(dt);
    // A sideways throw: picked up by its middle, swept right and let go.
    const c = player.stage.toScreen(b.pos);
    h.pressAt(b.pos.slice(), c[0], c[1]);
    for (let k = 1; k <= 12; k++) {
      h.moveTo(c[0] + k * 12, c[1] - k * 4);
      player.update(dt);
    }
    h.release();
    const v0 = Math.hypot(...b.vel) / R;
    let t2 = 0;
    let maxX = 0;
    for (; t2 < 10; t2 += dt) {
      player.update(dt);
      maxX = Math.max(maxX, Math.hypot(b.pos[0] - home[0], b.pos[2] - home[2]) / R);
      if (h.world.asleep) break;
    }
    const spun = Math.hypot(...b.omega);
    h.reset();
    for (let k = 0; k < 120; k++) player.update(dt);
    return { id, round: !!b.solid, R: +R.toFixed(3), e: b.restitution, drop, throw: { v0: +v0.toFixed(2), far: +maxX.toFixed(2), rest: +t2.toFixed(2), spun: +spun.toFixed(2) } }; // prettier-ignore
  }, id);
  console.log(JSON.stringify(out));
}
await browser.close();
