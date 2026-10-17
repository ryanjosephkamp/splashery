// Eight real product recordings at phone size; this is Chromium emulation,
// never a claim about physical-phone speed, sensors, or GPU memory.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
const root = process.cwd(),
  out = path.resolve(".cache/pano3d/evidence");
fs.mkdirSync(out, { recursive: true });
const port = 4188,
  base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["tools/cdx-mp2-server.mjs", String(port)], {
  stdio: "ignore",
});
for (let i = 0; i < 100; i++) {
  try {
    await fetch(base);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
function memory(rootPid) {
  const processes = [];
  for (const entry of fs.readdirSync("/proc").filter((v) => /^\d+$/.test(v))) {
    try {
      const s = fs.readFileSync("/proc/" + entry + "/stat", "utf8");
      processes.push([Number(entry), Number(s.slice(s.lastIndexOf(")") + 2).split(" ")[1])]);
    } catch {}
  }
  const selected = new Set([rootPid]);
  for (let pass = 0; pass < 20; pass++)
    for (const [pid, parent] of processes) if (selected.has(parent)) selected.add(pid);
  let pss = 0,
    rss = 0;
  for (const pid of selected)
    try {
      const s = fs.readFileSync("/proc/" + pid + "/smaps_rollup", "utf8");
      pss += Number(s.match(/^Pss:\s+(\d+)/m)?.[1] || 0) * 1024;
      rss += Number(s.match(/^Rss:\s+(\d+)/m)?.[1] || 0) * 1024;
    } catch {}
  return { pss, rss };
}
const entries = [
  { id: "room", sample: "room" },
  { id: "room2", sample: "room2" },
  ...["room", "desk", "stairs", "arches", "steps", "lattice"].map((id) => ({
    id: "truth-" + id,
    file: ".cache/pano3d/truth/" + id + "/pano.jpg",
  })),
];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sourceFiles = [
  ...fs.readdirSync("src/pano3d").map((name) => "src/pano3d/" + name),
  "src/depth/engine.js",
  "src/stage.js",
  "src/kit.js",
  "src/player.js",
  "vendor/depth-anything-v2-small/model_quantized.onnx",
  "tools/pano-clips.mjs",
  "assets/toys/step-inside-360/room.depth",
  "assets/toys/step-inside-360/room2.depth",
];
const graphics = process.env.SPLASHERY_GL === "llvmpipe" ? "llvmpipe" : "swiftshader";
const study = {
  createdUTC: new Date().toISOString(),
  source: Object.fromEntries(sourceFiles.map((f) => [f, sha256(f)])),
  graphics,
  note: "390×844, device scale factor 3, forced low profile, real WebGL2 splats and WASM depth. Desktop Chromium with software graphics, not physical-phone evidence. Hardware and concurrent work affect timings. First look includes an interactive constant-radius preview. Process-tree PSS sampled every 100 ms; short peaks can be missed. RSS double-counts shared pages.",
  model: "Codex (GPT-6)",
  entries: [],
};
try {
  for (const entry of entries) {
    console.log("Recording " + entry.id);
    const launched = await chromium.launchServer({
      executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
      headless: graphics !== "llvmpipe",
      args: [
        "--no-sandbox",
        ...(graphics === "llvmpipe"
          ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
          : ["--use-angle=swiftshader"]),
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    });
    let browser, context, timer;
    try {
      browser = await chromium.connect(launched.wsEndpoint());
      context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        recordVideo: {
          dir: path.resolve(".cache/pano3d/raw-video"),
          size: { width: 390, height: 844 },
        },
      });
      const page = await context.newPage(),
        samples = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      timer = setInterval(
        () => samples.push({ time: Date.now(), ...memory(launched.process().pid) }),
        100,
      );
      await page.goto(base + "/?labs=1&renderer=webgl2&profile=low&adapt=off");
      await page.waitForSelector("body[data-ready=true]");
      const start = Date.now();
      await page.evaluate(() => window.__splashery.app.chooseToy("step-inside-360"));
      if (entry.sample === "room2")
        await page.evaluate(() => window.__splashery.app.setToyOptions({ source: "room2" }));
      if (entry.file)
        await page.locator("#toy-input-file").setInputFiles(path.join(root, entry.file));
      await page.waitForFunction((custom) => {
        const p = window.__splashery?.player;
        return (
          !p?.loading &&
          p?.toyInfo?.recipe?.inside &&
          (!custom || p.scene.toy.options?.source === "custom")
        );
      }, !!entry.file);
      await page.evaluate(() => window.__splashery.player.stage.captureFrame());
      const firstLookMs = Date.now() - start;
      await page.waitForFunction(
        () =>
          window.__splashery?.player?.motion?.out?.legend?.items?.some((i) =>
            i.text?.startsWith("Depth ready"),
          ),
        null,
        { timeout: 180000 },
      );
      const depthReadyMs = Date.now() - start;
      const actionsStartedMs = depthReadyMs;
      // A complete turn, including the longitude seam, then ceiling and floor.
      const pose = async (yaw, pitch) =>
        page.evaluate(
          ({ yaw, pitch }) => {
            const c = window.__splashery.player.camera;
            c.cur.yaw = c.tgt.yaw = yaw;
            c.cur.pitch = c.tgt.pitch = pitch;
            window.__splashery.player.stage.requestRender();
          },
          { yaw, pitch },
        );
      for (let i = 0; i <= 24; i++) {
        await pose((i / 24) * Math.PI * 2, 0);
        await page.evaluate(() => window.__splashery.player.stage.captureFrame());
        await page.waitForTimeout(90);
      }
      for (const pitch of [-1.4, 1.4, 0]) {
        await pose(0, pitch);
        await page.evaluate(() => window.__splashery.player.stage.captureFrame());
        await page.waitForTimeout(350);
      }
      await page.locator("#sheet-toggle").click();
      await page.locator("#pano-right").click();
      await page.locator("#pano-right").click();
      await page.waitForFunction(
        () => Math.hypot(...window.__splashery.player.motion.out.parts.shell.offset) > 0.28,
      );
      await page.locator("#pano-home").click();
      for (let i = 0; i < 4; i++) await page.locator("#pano-step").click();
      await page.waitForFunction(
        () => Math.hypot(...window.__splashery.player.motion.out.parts.shell.offset) > 0.75,
      );
      await page.locator("#sheet-toggle").click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, entry.id + "-step.png") });
      const warningShown = await page.evaluate(() =>
        window.__splashery.player.motion.out.legend.items.some((v) =>
          v.text.startsWith("Stretch warning"),
        ),
      );
      await page.locator("#sheet-toggle").click();
      await page.locator("#pano-home").click();
      await page.locator("#sheet-toggle").click();
      await page.waitForTimeout(600);
      const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
      const record = {
        ...entry,
        firstLookMs,
        depthReadyMs,
        actionsStartedMs,
        actionsFinishedMs: Date.now() - start,
        sourceSha256: sha256(entry.file || "assets/toys/step-inside-360/" + entry.id + ".jpg"),
        warningShown,
        buffer: await page.evaluate(() => {
          const c = window.__splashery.player.stage.canvas;
          return c ? [c.width, c.height] : null;
        }),
        peakPssBytes: Math.max(...samples.map((s) => s.pss)),
        peakRssBytes: Math.max(...samples.map((s) => s.rss)),
        mainHeapBytes: heap,
        errors,
        clip: entry.id + ".webm",
      };
      study.entries.push(record);
      const video = page.video();
      await context.close();
      const raw = path.resolve(".cache/pano3d/raw-video", entry.id + ".webm"),
        target = path.join(out, record.clip);
      await video.saveAs(raw);
      // Preserve the complete native recording, including all verified camera draws.
      fs.copyFileSync(raw, target);
      fs.writeFileSync(path.join(out, "phone-profile.json"), JSON.stringify(study, null, 2) + "\n");
      console.log(JSON.stringify(record));
    } finally {
      clearInterval(timer);
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
      await launched.close();
    }
  }
} finally {
  server.kill();
}
