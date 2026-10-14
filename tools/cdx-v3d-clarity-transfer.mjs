#!/usr/bin/env node
// Cold network transfers through the actual embed, with device Auto choosing each fitted tier.
// <output.json> [sample-id ...]. The site must be served; no source video is opened.
import fs from "node:fs";
import { chromium, devices } from "@playwright/test";
import { SAMPLES } from "../src/video3d/samples.js";
import { createScene } from "../src/state.js";
import { encodeSceneHash } from "../src/codec.js";

const [output, ...ids] = process.argv.slice(2);
if (!output) throw new Error("Supply an output JSON path outside the shipping assets.");
const samples = SAMPLES.filter((s) => !ids.length || ids.includes(s.id));
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const sample of samples) {
    for (const phone of [true, false]) {
      const context = await browser.newContext({
        ...(phone ? devices["Pixel 7"] : {}),
        viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        hasTouch: phone,
        isMobile: phone,
      });
      try {
        const page = await context.newPage(),
          cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        let transferBytes = 0;
        const errors = [];
        cdp.on("Network.loadingFinished", (e) => (transferBytes += e.encodedDataLength || 0));
        page.on("pageerror", (e) => errors.push(e.message));
        const hash = await encodeSceneHash(
          createScene({
            toy: {
              kind: "builtin",
              id: "video-3d",
              options: { source: sample.id, navigation: "walk" },
            },
          }),
        );
        await page.goto(`${base}/embed/?labs=1&renderer=webgl2#s=${hash}`);
        await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        const actual = await page.evaluate(async (id) => {
          const player = window.__splashery.player;
          const info = player.proc.ctx.kit.data.video;
          const manifest = await (
            await fetch(`/assets/toys/video-3d/${id}-baked/manifest.json`)
          ).json();
          const tier = manifest.tiers.find((t) => t.splats === info.stats.exportedSplats);
          return {
            id: info.uid,
            role: tier?.role,
            splats: info.stats.exportedSplats,
            profile: player.profile,
            auto: player.autoTier,
            adaptation: player.stage.sharp?.adapt,
            nativeDpr: devicePixelRatio,
            pixelRatio: player.stage.device.maxPixelRatio,
            profilePixelCap: player.stage.pixelCap,
          };
        }, sample.id);
        await page.waitForLoadState("networkidle");
        if (
          errors.length ||
          actual.id !== sample.id ||
          actual.role !== (phone ? "phone" : "desktop") ||
          !actual.auto ||
          actual.adaptation !== "off" ||
          actual.pixelRatio > actual.profilePixelCap
        )
          throw new Error(
            `Wrong Auto selection or browser error: ${JSON.stringify({ actual, errors })}`,
          );
        if (transferBytes > 30000000) throw new Error("Embed exceeds the 30 MB goal.");
        results.push({ id: sample.id, emulatedPhone: phone, transferBytes, ...actual });
        fs.writeFileSync(
          output,
          JSON.stringify(
            {
              measured: new Date().toISOString(),
              renderer:
                "Chromium WebGL2 / SwiftShader; cold cache; CDP encoded bytes including headers",
              results,
            },
            null,
            2,
          ) + "\n",
        );
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
