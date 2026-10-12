#!/usr/bin/env node
// Task 41: real Chromium + the shipped depth worker, fake input only.
// Start the static server, then:
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-mir-measure.mjs .cache/cdx-mir before ec4aaa37
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { CLIPS, cameras } from "./cdx-mir-camera.mjs";
import { fakeCamera, openMirror, measure } from "./lv7-mirror-measure.mjs";
import config from "../playwright.config.mjs";

export async function timing(page, secs = 8) {
  await page.evaluate(async () => {
    const { MIRROR } = await import("/src/live/relief.js");
    const cam = MIRROR.cam;
    const S = (window.__cdxMir = {
      draw: [],
      answer: [],
      latency: [],
      height: [],
      movingHeight: [],
      frameMs: [],
      n: 0,
      sent: new Map(),
    });
    const ask = cam.ask;
    const answer = cam.onAnswer;
    const draw = cam.draw;
    cam.ask = function () {
      const busy = this.busy;
      const t = performance.now();
      ask.call(this);
      if (!busy && this.busy) S.sent.set(this.id, t);
    };
    cam.onAnswer = function (m) {
      const n = this.answers;
      const t = performance.now();
      const captured = S.sent.get(m.id);
      S.sent.delete(m.id);
      answer.call(this, m);
      if (n !== this.answers) {
        S.answer.push(performance.now() - t);
        S.pending = captured;
      }
    };
    cam.draw = function (...args) {
      const t = performance.now();
      const result = draw.apply(this, args);
      const end = performance.now();
      S.draw.push(end - t);
      if (S.lastTime) S.frameMs.push(t - S.lastTime);
      S.lastTime = t;
      if (S.pending != null) {
        S.latency.push(end - S.pending);
        S.pending = null;
      }
      if (S.h && S.c) {
        let still = 0,
          move = 0,
          ns = 0,
          nm = 0;
        for (let i = 0; i < this.heights.length; i++) {
          const c = i * 4;
          const change =
            Math.abs(this.lastColors[c] - S.c[c]) +
            Math.abs(this.lastColors[c + 1] - S.c[c + 1]) +
            Math.abs(this.lastColors[c + 2] - S.c[c + 2]);
          const delta = Math.abs(this.heights[i] - S.h[i]);
          if (change < 12) {
            still += delta;
            ns++;
          } else {
            move += delta;
            nm++;
          }
        }
        if (ns) S.height.push(still / ns);
        if (nm) S.movingHeight.push(move / nm);
      }
      S.h = this.heights.slice();
      S.c = this.lastColors?.slice();
      S.n++;
      return result;
    };
    S.restore = () => {
      cam.ask = ask;
      cam.onAnswer = answer;
      cam.draw = draw;
    };
  });
  await page.waitForTimeout(secs * 1000);
  return page.evaluate(() => {
    const S = window.__cdxMir;
    S.restore();
    const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const med = (a) => [...a].sort((a, b) => a - b)[a.length >> 1] ?? null;
    return {
      drawnFrames: S.n,
      depthAnswers: S.latency.length,
      latencyMs: med(S.latency),
      drawP50Ms: med(S.draw),
      answerP50Ms: med(S.answer),
      frameP50Ms: med(S.frameMs),
      stillHeightPerFrame: avg(S.height),
      movingHeightPerFrame: avg(S.movingHeight),
    };
  });
}

export async function run(dir, label, answers = 6, clips = CLIPS, revision = null) {
  cameras(dir);
  // Every clip uses one immutable module while a long measurement runs.
  const source = revision
    ? execFileSync("git", ["show", `${revision}:src/live/relief.js`], { encoding: "utf8" })
    : fs.readFileSync(new URL("../src/live/relief.js", import.meta.url), "utf8");
  const results = {};
  for (const clip of clips) {
    const browser = await chromium.launch({
      ...config.use.launchOptions,
      args: fakeCamera(path.resolve(dir, `${clip}.y4m`), config.use.launchOptions.args),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      await page.route("**/src/live/relief.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body: source }),
      );
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openMirror(page, process.env.SPLASHERY_URL || "http://127.0.0.1:4173/");
      const t = await timing(page);
      const m = await measure(page, { answers, dump: path.join(dir, `${label}-${clip}`) });
      results[clip] = { ...m, ...t, errors };
      fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(results, null, 2));
      console.log(`${label} ${clip}: ${JSON.stringify(results[clip])}`);
    } finally {
      await browser.close();
    }
  }
  return results;
}
if (import.meta.url === `file://${process.argv[1]}`)
  await run(
    process.argv[2] || ".cache/cdx-mir",
    process.argv[3] || "after",
    6,
    CLIPS,
    process.argv[4],
  );
