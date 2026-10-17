// Real rendered review captures, with simulation stepped at 30 Hz. This is not
// a real-time FPS measurement; cdx-walk-performance.spec.mjs measures cadence.
// Start the normal local server, then:
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-evidence.mjs /tmp/walk-evidence --clips
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const out = path.resolve(process.argv[2] || ".cache/walk-evidence");
const clips = process.argv.includes("--clips");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const scene = Buffer.from(
  JSON.stringify({
    app: "splashery",
    version: 3,
    toy: { kind: "builtin", id: "walk-inside" },
    autoplay: { turntable: false },
  }),
).toString("base64url");
const errors = [];
async function open(viewport, phone) {
  const context = await browser.newContext({
    viewport,
    hasTouch: phone,
    isMobile: phone,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${process.env.SPLASHERY_PORT || 4173}/?labs=1&renderer=webgl2&profile=${phone ? "low" : "high"}&clock=manual&adapt=off#s=j.${scene}`,
  );
  await page.waitForFunction(() => globalThis.__splashery?.player?.toyInfo?.id === "walk-inside");
  await page.evaluate(async () => {
    const { openWalk } = await import("/src/walk/main.js");
    await openWalk(globalThis.__splashery.player.profile);
  });
  await page.waitForFunction(() => document.querySelector("#walk-dialog")?.walk?.body);
  await page.evaluate(() => {
    const detail = document.querySelector("#walk-detail");
    detail.value = "full";
    detail.dispatchEvent(new Event("change"));
    document.querySelector("#walk-canvas").focus();
  });
  return { context, page };
}
try {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const { context, page } = await open({ width, height }, width === 390);
    for (const room of ["gallery", "courtyard"]) {
      await page.locator("#walk-place").selectOption(room);
      await page.waitForFunction(() => !document.querySelector("#walk-dialog").walk.busy);
      await page.evaluate(async () => {
        const w = document.querySelector("#walk-dialog").walk;
        w.yaw = -0.32;
        w.advance(0);
        await w.view.world.nextFrame();
      });
      const file = path.join(out, `cdx-walk-${room}-${width}x${height}.png`);
      await page.screenshot({ path: file });
      console.log(file);
      if (room === "courtyard" && width === 390) {
        await page.keyboard.down("KeyS");
        await page.evaluate(async () => {
          const w = document.querySelector("#walk-dialog").walk;
          for (let i = 0; i < 120; i++) w.advance(1 / 30);
          w.yaw = Math.PI;
          w.advance(0);
          await w.view.world.nextFrame();
        });
        await page.keyboard.up("KeyS");
        await page.screenshot({ path: path.join(out, "cdx-walk-capture-edge-390x844.png") });
        await page.locator("#walk-reset").click();
        await page.locator("#walk-settings summary").click();
        await page.locator("#walk-meters").fill("100");
        await page.locator("#walk-level").click();
        await page.waitForFunction(() =>
          document.querySelector("#walk-status").textContent.includes("too large"),
        );
        await page.screenshot({ path: path.join(out, "cdx-walk-level-error-390x844.png") });
      }
    }
    await context.close();
  }
  if (clips) {
    for (const room of ["gallery", "courtyard"]) {
      const { context, page } = await open({ width: 608, height: 1080 }, true);
      await page.locator("#walk-place").selectOption(room);
      await page.waitForFunction(() => !document.querySelector("#walk-dialog").walk.busy);
      const file = path.join(out, `cdx-walk-${room}-20s-1080p30.mp4`);
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-f",
          "image2pipe",
          "-framerate",
          "30",
          "-vcodec",
          "mjpeg",
          "-i",
          "pipe:0",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          file,
        ],
        { stdio: ["pipe", "ignore", "inherit"] },
      );
      const completed = once(ffmpeg, "close");
      const keys = ["KeyW", "KeyD", "KeyS", "KeyA", null];
      let key = null;
      for (let frame = 0; frame < 600; frame++) {
        const next = keys[Math.floor(frame / 120)];
        if (next !== key) {
          if (key) await page.keyboard.up(key);
          if (next) await page.keyboard.down(next);
          key = next;
        }
        if (frame === 450) {
          await page.getByRole("button", { name: "Character", exact: true }).click();
          await page.waitForFunction(() => document.querySelector("#walk-dialog").walk.thirdPerson);
        }
        await page.evaluate(
          async ({ frame }) => {
            const w = document.querySelector("#walk-dialog").walk;
            if (frame > 420) w.yaw += 0.009;
            w.advance(1 / 30);
            await w.view.world.nextFrame();
          },
          { frame },
        );
        const bytes = await page.screenshot({ type: "jpeg", quality: 92 });
        if (!ffmpeg.stdin.write(bytes)) await once(ffmpeg.stdin, "drain");
        if (frame % 120 === 0) console.log(`${room}: ${frame}/600 frames`);
      }
      ffmpeg.stdin.end();
      const [code] = await completed;
      if (code) throw new Error(`ffmpeg exited ${code}`);
      console.log(file);
      await context.close();
    }
  }
  await fs.writeFile(
    path.join(out, "capture.json"),
    JSON.stringify(
      {
        method: "Chromium/Playwright; actual rendered frames; simulation stepped 1/30 second",
        resolution: "Full resolution opt-in; pixel ratio 1. Auto cadence measured separately.",
        sourceCommit,
        clipSize: clips ? "608×1080" : null,
        frames: clips ? 600 : 0,
        fps: clips ? 30 : null,
        seconds: clips ? 20 : 0,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
