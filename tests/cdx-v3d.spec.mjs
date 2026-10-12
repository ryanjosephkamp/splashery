import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveObjectURL } from "node:buffer";

// A repeatable two-depth textured view; a uniform pan moves both halves equally.
function views({ near = 3, far = 1, flat = false, exposure = 0 } = {}) {
  const width = 128;
  const height = 80;
  return [0, 1, 2, 3].map((t) => ({
    width,
    height,
    gray: Float32Array.from({ length: width * height }, (_, i) => {
      const y = Math.floor(i / width);
      const x = (i % width) + t * (y < height / 2 ? near : far);
      return flat ? 128 : 40 + (((x * 17 + y * 23) ^ (x * y * 7)) & 127) + t * exposure;
    }),
  }));
}

test("clip feedback distinguishes translation with parallax, a pan, and a blank clip", async () => {
  const { assessFrames } = await import("../src/video3d/suitability.js");
  expect(assessFrames(views()).verdict).toBe("promising");
  expect(assessFrames(views({ near: 2, far: 2 })).verdict).toBe("caution");
  const flat = assessFrames(views({ flat: true }));
  expect(flat.verdict).toBe("poor");
  expect(flat.reasons.join(" ")).toMatch(/texture|details/);
  expect(assessFrames(views({ near: 0, far: 0 })).reasons.join(" ")).toMatch(/move|motion/);
  expect(assessFrames(views({ exposure: 28 })).reasons.join(" ")).toMatch(/light|brightness/);
});

const path = [0, 1, 2, 3].map((time) => ({
  time,
  pos: [0, 0, -time * 0.3],
  yaw: 0,
  pitch: 0,
  roll: 0,
  f: 500,
  w: 640,
  h: 480,
}));

test("affine walk geometry preserves perspective from translated captured cameras", async () => {
  const { splatsInFrame, toyCamera } = await import("../src/video3d/scene.js");
  const frame = {
    M: [
      [0, 0, 1],
      [0, 1, 0],
      [-1, 0, 0],
    ],
    center: [0.2, -0.4, 0.7],
    scale: 0.6,
  };
  const s = {
    count: 2,
    pos: new Float32Array([2, 0.4, -4, -3, 1, -7]),
    scales: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
    quat: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
    color: new Float32Array(6).fill(0.5),
    opacity: new Float32Array(2).fill(0.9),
  };
  const out = splatsInFrame(frame, s, { contract: false });
  for (const C of [
    [0, 0, 0],
    [0.4, 0.1, 0.2],
    [-0.2, 0.3, -0.1],
  ]) {
    const camera = toyCamera(frame, { R: [1, 0, 0, 0, -1, 0, 0, 0, -1], t: [-C[0], C[1], C[2]] });
    const right = [
      camera.forward[1] * camera.up[2] - camera.forward[2] * camera.up[1],
      camera.forward[2] * camera.up[0] - camera.forward[0] * camera.up[2],
      camera.forward[0] * camera.up[1] - camera.forward[1] * camera.up[0],
    ];
    for (let i = 0; i < s.count; i++) {
      const v = Array.from(out.pos.subarray(i * 3, i * 3 + 3), (x, k) => x - camera.pos[k]);
      const depth = v.reduce((sum, x, k) => sum + x * camera.forward[k], 0);
      const x = v.reduce((sum, x, k) => sum + x * right[k], 0) / depth;
      const y = v.reduce((sum, x, k) => sum + x * camera.up[k], 0) / depth;
      expect(x).toBeCloseTo((s.pos[i * 3] - C[0]) / (C[2] - s.pos[i * 3 + 2]), 6);
      expect(y).toBeCloseTo((s.pos[i * 3 + 1] - C[1]) / (C[2] - s.pos[i * 3 + 2]), 6);
    }
  }
  for (let i = 0; i < s.scales.length; i++)
    expect(out.scales[i]).toBeCloseTo(s.scales[i] * frame.scale, 6);
  expect(Array.from(out.outer)).toEqual([0, 0]);
});

test("walking eases motion and stays in the filmed corridor, including its ends", async () => {
  const { createWalk, closestPathPoint } = await import("../src/video3d/walk.js");
  const walk = createWalk(path);
  const before = walk.state.pos.slice();
  walk.step(1 / 60, { forward: 1 });
  expect(walk.state.pos[2]).toBeLessThan(before[2]);
  expect(walk.state.pos[2]).toBeGreaterThan(before[2] - 0.01);
  for (let i = 0; i < 1500; i++) walk.step(1 / 60, { forward: 1, right: 1 });
  const hit = closestPathPoint(path, walk.state.pos);
  expect(Math.hypot(...walk.state.pos.map((v, k) => v - hit.pos[k]))).toBeLessThanOrEqual(
    walk.radius + 1e-6,
  );
  expect(walk.state.pos[2]).toBeGreaterThanOrEqual(-0.9 - walk.radius);
  walk.step(10, { forward: 1 }); // a resumed tab must not leap through the world
  expect(walk.state.pos.every(Number.isFinite)).toBe(true);
  walk.reset();
  expect(walk.state.pos).toEqual(before);
});

test("walking keeps the view within filmed directions rather than looking through the back of a scene", async () => {
  const { createWalk } = await import("../src/video3d/walk.js");
  const walk = createWalk(path);
  for (let i = 0; i < 300; i++) walk.step(1 / 60, { lookX: 20, lookY: 20 });
  expect(Math.abs(walk.state.yaw)).toBeLessThanOrEqual(walk.lookLimit + 1e-6);
  expect(Math.abs(walk.state.pitch)).toBeLessThanOrEqual(0.5 + 1e-6);
});

test("cleanup rejects single-view floaters and sky rays while retaining supported surfaces", async () => {
  const { cleanScene } = await import("../src/video3d/cleanup.js");
  const scene = {
    count: 4,
    pos: new Float32Array([0.1, 0, -0.5, 0.5, 0, -0.85, 0, 1.6, -0.5, 0, 0, -0.15]),
    scales: new Float32Array([
      0.08, 0.04, 0.0001, 0.01, 0.01, 0.01, 0.5, 0.001, 0.001, 0.01, 0.01, 0.01,
    ]),
    quat: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    color: new Float32Array([0.4, 0.3, 0.2, 0.4, 0.3, 0.2, 0.6, 0.75, 0.9, 0.4, 0.3, 0.2]),
    opacity: new Float32Array([0.9, 0.9, 0.5, 0.9]),
    outer: new Uint8Array([0, 0, 1, 0]),
  };
  const r = cleanScene(scene, path);
  expect(r.scene.count).toBe(1);
  expect(r.scene.pos[2]).toBeCloseTo(-0.5);
  expect(r.removed.unsupported).toBeGreaterThan(0);
  expect(r.removed.ray).toBe(1);
  expect(r.removed.atPath).toBe(1);
  expect(r.clamped).toBe(1);
  expect(r.scene.scales[0]).toBeCloseTo(0.035);
  expect(r.scene.scales[1] / r.scene.scales[0]).toBeCloseTo(0.5);
  expect(r.sky.every((v) => v >= 0 && v <= 1)).toBe(true);
  for (const key of ["color", "quat"]) {
    const bad = { ...scene, [key]: scene[key].slice() };
    bad[key][0] = NaN;
    const rejected = cleanScene(bad, path);
    expect(rejected.removed.invalid).toBe(1);
    expect(rejected.scene.count).toBe(0);
  }
});

test("a replacement training plan releases an earlier confirmation", async ({ page }) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { progressCard } = await import("/src/video3d/panel.js");
    const card = progressCard();
    card.reset("old clip");
    const old = card.confirm("old plan");
    card.reset("new clip");
    return Promise.race([
      old,
      new Promise((resolve) => setTimeout(() => resolve("still waiting"), 200)),
    ]);
  });
  expect(result).toBe(false);
});

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

// Real decoding and card behavior, with a small player shell for selection ownership. These
// lifecycle tests never create a renderer or a trainer.
const videoShell = () => {
  window.__splashery = {
    player: {
      loadToken: 1,
      profile: "low",
      scene: { toy: { id: "video-3d", options: { source: "liberty" } } },
    },
  };
};

test("an unplayable file is rejected without replacing the previously checked clip", async ({
  page,
}) => {
  await page.addInitScript(videoShell);
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { openVideoFile, video3dState } = await import("/src/packs/video3d.js");
    const blob = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
    await openVideoFile(new File([blob], "kept.webm", { type: "video/webm" }), "kept");
    const before = video3dState().suitability;
    let error = "";
    try {
      await openVideoFile(
        new File(["not video data"], "broken.mp4", { type: "video/mp4" }),
        "broken",
      );
    } catch (e) {
      error = e.message;
    }
    return { error, before, after: video3dState().suitability };
  });
  expect(result.error).toMatch(/cannot play|no picture/);
  expect(result.after).toEqual(result.before);
  await expect(page.locator("#v3d-card .v3d-err")).toContainText(/cannot play|no picture/);
});

for (const change of ["toy", "source"]) {
  test(`changing the ${change} cancels a pending file check and hides its card`, async ({
    page,
  }) => {
    await page.addInitScript(videoShell);
    await page.goto("/tests/fixtures/v3d/");
    await page.evaluate(async () => {
      const { openVideoFile, video3dState } = await import("/src/packs/video3d.js");
      const blob = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
      window.pendingCheck = openVideoFile(
        new File([blob], "orbit.webm", { type: "video/webm" }),
        "orbit",
      ).then(
        () => ({ name: "accepted" }),
        (e) => ({ name: e.name, state: video3dState() }),
      );
    });
    await page.waitForSelector("#v3d-card");
    await page.evaluate((change) => {
      const p = window.__splashery.player;
      if (change === "toy") p.scene.toy = { id: "diamond", options: {} };
      else p.scene.toy.options.source = "edinburgh";
      p.loadToken++;
    }, change);
    const result = await page.evaluate(() => window.pendingCheck);
    expect(result.name).toBe("AbortError");
    expect(result.state.suitability).toBeUndefined();
    await expect(page.locator("#v3d-card")).toBeHidden();
  });
}

test("leaving during training confirmation releases the preparation without starting a trainer", async ({
  page,
}) => {
  await page.route("**/tests/fixtures/v3d/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script type="importmap">{"imports":{"gifenc":"/vendor/gifenc/gifenc.esm.js"}}</script>',
    }),
  );
  await page.addInitScript(videoShell);
  await page.addInitScript(() => {
    // Adapter availability is stubbed only to reach the confirmation; no GPU methods run.
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () => ({ requestAdapter: async () => ({ info: { description: "confirmation test" } }) }),
    });
    window.__v3dPhone = true;
  });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/tests/fixtures/v3d/");
  await page.evaluate(async () => {
    const { openVideoFile, RECIPES } = await import("/src/packs/video3d.js");
    const blob = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
    await openVideoFile(new File([blob], "orbit.webm", { type: "video/webm" }), "orbit");
    const o = { source: "custom", start: "0", length: "10", rate: "3", setting: "phone" };
    window.__splashery.player.scene.toy.options = o;
    window.pendingPreparation = RECIPES["video-3d"].prepare(o).then(() => "released");
  });
  await page.waitForSelector("#v3d-start");
  await page.evaluate(() => {
    const p = window.__splashery.player;
    p.scene.toy = { id: "diamond", options: {} };
    p.loadToken++;
  });
  const result = await page.evaluate(() =>
    Promise.race([
      window.pendingPreparation,
      new Promise((r) => setTimeout(() => r("still waiting"), 1500)),
    ]),
  );
  expect(result).toBe("released");
  await expect(page.locator("#v3d-card")).toBeHidden();
  expect(requests.filter((u) => /vendor\/splatjs/.test(u))).toEqual([]);
});

test("changing navigation reuses a learned custom result and keeps its original-video identity", async ({
  page,
}) => {
  await page.route("**/tests/fixtures/v3d/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><script type="importmap">{"imports":{"gifenc":"/vendor/gifenc/gifenc.esm.js"}}</script>',
    }),
  );
  // Stub the expensive training call with an existing real export. File decoding, preparation,
  // both display conversions, identity, and the result cache are the production code.
  await page.route("**/src/video3d/run.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const isPhone=()=>false, estimateMinutes=()=>[1,2], webgpuStatus=async()=>({ok:true});
      export async function videoTo3D(){window.trainingCalls=(window.trainingCalls||0)+1;
        const [ply,meta]=await Promise.all([fetch('/assets/toys/video-3d/liberty.ply').then(r=>r.arrayBuffer()),fetch('/assets/toys/video-3d/liberty.json').then(r=>r.json())]);
        return {...meta,ply:new Uint8Array(ply),timings:{total:1},log:[]};}`,
    }),
  );
  await page.addInitScript(videoShell);
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { openVideoFile, RECIPES, video3dResult } = await import("/src/packs/video3d.js");
    const blob = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
    await openVideoFile(new File([blob], "kept.webm", { type: "video/webm" }), "kept");
    window.__v3dSettings = {};
    const o = {
      source: "custom",
      start: "0",
      length: "10",
      rate: "3",
      setting: "phone",
      navigation: "orbit",
    };
    window.__splashery.player.scene.toy.options = o;
    const k = { count: 160000, cloud() {}, reach() {} };
    await RECIPES["video-3d"].prepare(o);
    const learned = video3dResult();
    RECIPES["video-3d"].build(k, o);
    const orbit = { ...k.data.video };
    o.navigation = "walk";
    await RECIPES["video-3d"].prepare(o);
    RECIPES["video-3d"].build(k, o);
    const walk = { ...k.data.video };
    o.navigation = "orbit";
    await RECIPES["video-3d"].prepare(o);
    RECIPES["video-3d"].build(k, o);
    return {
      calls: window.trainingCalls,
      same: video3dResult() === learned,
      orbit,
      walk,
      back: k.data.video,
    };
  });
  expect(result.calls).toBe(1);
  expect(result.same).toBe(true);
  expect(result.walk.uid).toBe(result.orbit.uid);
  expect(result.walk.custom).toBe(true);
  expect(result.back.uid).toBe(result.orbit.uid);
  expect(result.walk.splats).toBeGreaterThan(1000);
});

test("short training refines before the phone budget ends", async () => {
  const { createSession } = await import("../vendor/splatjs/src/session.js");
  const session = createSession({
    maxIters: 1200,
    refineStart: 100,
    refineEvery: 100,
    itersPerFrame: 2,
  });
  // The actual session loop with GPU calls stubbed: this proves schedule selection, not quality.
  let refined = 0;
  session.trainer = {
    camMeta: [{}],
    iter: 100,
    n: 100,
    stepOnce() {
      this.iter++;
    },
    async refine() {
      refined++;
      return { moved: 0, grown: 0, n: 100 };
    },
    device: { queue: { onSubmittedWorkDone: () => Promise.resolve() } },
  };
  session.training = true;
  session._lastStats = performance.now();
  session._frameCount = 0;
  session._sched = { raf() {} };
  await session._frameLoop();
  expect(refined).toBe(1);
});

test("Replay releases its audio and lens when its scene ownership changes, including a late embed", async () => {
  const { makeFlight } = await import("../src/video3d/flight.js");
  const oldWindow = globalThis.window;
  const oldAudio = globalThis.Audio;
  let flight;
  try {
    for (const change of ["toy", "load", "accepted replacement", "new lens owner", "audio error"]) {
      const pose = { yaw: 0, pitch: 0, roll: 0, distance: 1 };
      const camera = {
        cur: { ...pose },
        tgt: { ...pose },
        vel: {},
        target: [0, 0, 0],
        minDistance: 0.01,
        maxDistance: 20,
        idleFor: 0,
        getState() {
          return { ...this.cur };
        },
        setState(s) {
          this.cur = this.tgt = { ...s };
        },
      };
      const lens = { fov: 45, horizontalFov: false };
      const player = {
        camera,
        loadToken: 1,
        scene: { toy: { id: "video-3d" } },
        stage: {
          cameraEntity: { camera: lens },
          app: { graphicsDevice: { canvas: { width: 640, height: 360 } } },
        },
      };
      let audio;
      globalThis.Audio = class {
        constructor(url) {
          audio = this;
          this.url = url;
          this.paused = true;
        }
        play() {
          this.paused = false;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      };
      globalThis.window = { __splashery: {} }; // An embed publishes its player after build.
      let selected = true;
      const cams = [0, 10].map((time) => ({
        time,
        pos: [0, 0, 1 - time / 10],
        yaw: 0,
        pitch: 0,
        roll: 0,
        f: 400,
        w: 640,
        h: 360,
      }));
      flight = makeFlight(cams, { file: new Blob(["local video"]) }, { isCurrent: () => selected });
      window.__splashery.player = player;
      flight(1, {
        time: 0,
        sound: {
          enabled: true,
          audio: () => ({
            createMediaElementSource: () => {
              if (change === "audio error") throw new Error("The audio device closed");
              return { connect() {} };
            },
          }),
          master: {},
        },
      });
      expect(audio.paused).toBe(change === "audio error");
      if (change === "audio error") expect(resolveObjectURL(audio.url)).toBeUndefined();
      expect(lens.fov).not.toBe(45);
      if (change === "toy") player.scene.toy.id = "atom";
      else if (change === "load") player.loadToken++;
      else {
        selected = false;
        if (change === "new lens owner") lens.fov = 60;
      }
      await new Promise((resolve) => setTimeout(resolve, 320));
      expect(audio.paused, change).toBe(true);
      expect(flight.state.active, change).toBe(false);
      expect(lens.fov, change).toBe(change === "new lens owner" ? 60 : 45);
      expect(resolveObjectURL(audio.url), change).toBeUndefined();
      const held = { ...camera.cur };
      flight(1, { time: 5 });
      expect(camera.cur).toEqual(held);
      flight.dispose();
      flight = null;
    }
  } finally {
    flight?.dispose();
    globalThis.window = oldWindow;
    globalThis.Audio = oldAudio;
  }
});

test("Walk releases its controls while a replacement is loading and the old procedure is still present", async ({
  page,
}) => {
  await page.route("**/tests/fixtures/v3d/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.addInitScript(videoShell);
  await page.goto("/tests/fixtures/v3d/");
  for (const change of ["load", "accepted replacement"]) {
    await page.evaluate(async () => {
      const { mountWalk } = await import("/src/video3d/walk.js");
      const player = window.__splashery.player;
      player.camera = { target: [0, 0, 0], offset: [0, 0, 0], cur: {}, tgt: {}, minDistance: 0.01 };
      window.walkSelected = true;
      window.oldWalk = mountWalk(
        [0, 1].map((t) => ({ time: t, pos: [0, 0, -t], yaw: 0, pitch: 0, roll: 0 })),
        { isCurrent: () => window.walkSelected },
      );
      player.proc = { ctx: { kit: { data: { walk: window.oldWalk } } } };
    });
    await expect(page.locator("#v3d-walk")).toBeVisible();
    await page.waitForTimeout(300);
    await page.evaluate((change) => {
      if (change === "load") window.__splashery.player.loadToken++;
      else window.walkSelected = false;
    }, change);
    await expect(page.locator("#v3d-walk")).toHaveCount(0, { timeout: 3000 });
    expect(
      await page.evaluate(
        () => window.__splashery.player.proc.ctx.kit.data.walk === window.oldWalk,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => {
        window.oldWalk.drive({ time: 1 });
        return window.__splashery.player.camera.target;
      }),
    ).toEqual([0, 0, 0]);
  }
});

test("a real video receives suitability feedback within five seconds without loading the trainer", async ({
  page,
}) => {
  // Exercise real browser decoding independently of the renderer and any concurrently training GPU.
  await page.goto("/tests/fixtures/v3d/");
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const result = await page.evaluate(async () => {
    const { checkVideo } = await import("/src/video3d/suitability.js");
    const b = await (await fetch("/assets/toys/video-3d/liberty-source.webm")).blob();
    const start = performance.now();
    const check = await checkVideo(new File([b], "orbit.webm", { type: "video/webm" }));
    return { ...check, elapsed: performance.now() - start };
  });
  expect(result.elapsed).toBeLessThan(5100);
  expect(result.checked).toBe(true);
  expect(["promising", "caution"]).toContain(result.verdict);
  expect(result.metrics.frames).toBeGreaterThanOrEqual(3);
  expect(result.message).toBeTruthy();
  expect(requests.filter((u) => /vendor\/splatjs/.test(u))).toEqual([]);
});

test("a real decoded blank clip is rejected quickly without requiring WebGPU", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "cdx-v3d-flat-"));
  try {
    const file = join(dir, "flat.webm");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=gray:s=128x80:r=10",
      "-t",
      "2",
      "-c:v",
      "libvpx-vp9",
      file,
    ]);
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "gpu", {
        get: () => undefined,
        configurable: true,
      }),
    );
    await page.goto("/tests/fixtures/v3d/");
    const result = await page.evaluate(async (base64) => {
      const { checkVideo } = await import("/src/video3d/suitability.js");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const start = performance.now();
      const check = await checkVideo(new File([bytes], "flat.webm", { type: "video/webm" }));
      return { ...check, elapsed: performance.now() - start };
    }, readFileSync(file).toString("base64"));
    expect(result.verdict, JSON.stringify(result)).toBe("poor");
    expect(result.elapsed).toBeLessThan(5100);
    expect(result.reasons.join(" ")).toMatch(/texture|details/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("desktop keys and a mouse drag move the real stage camera, and leaving removes walk controls", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  await page.evaluate(() =>
    window.__splashery.app.setToyOptions({ source: "edinburgh", navigation: "walk" }),
  );
  await expect(page.locator("#v3d-walk")).toBeVisible();
  await page.evaluate(() => {
    window.__splashery.player.camera.offset = [0.5, 0.25, -0.2];
  });
  await page.waitForFunction(() => {
    const p = window.__splashery.player;
    return p.camera
      .pose()
      .position.every((v, k) => Math.abs(v - p.proc.ctx.kit.data.walk.state.pos[k]) < 1e-6);
  });
  const pos = () => page.evaluate(() => window.__splashery.player.camera.pose().position);
  const before = await pos();
  await page.keyboard.down("w");
  await page.waitForFunction(
    (p) =>
      Math.hypot(...window.__splashery.player.camera.pose().position.map((v, i) => v - p[i])) >
      0.001,
    before,
  );
  await page.keyboard.up("w");
  const after = await pos();
  expect(Math.hypot(...after.map((v, i) => v - before[i]))).toBeGreaterThan(0.001);
  const yaw = await page.evaluate(() => window.__splashery.player.camera.cur.yaw);
  await page.mouse.move(180, 250);
  await page.mouse.down();
  await page.mouse.move(225, 250, { steps: 3 });
  await page.mouse.up();
  await page.waitForFunction(
    (p) => Math.abs(window.__splashery.player.camera.cur.yaw - p) > 0.02,
    yaw,
  );
  await page.evaluate(() => window.__splashery.app.act());
  await expect(page.locator("#v3d-walk")).toBeHidden();
  await page.waitForFunction(() => {
    const f = window.__splashery.player.proc.ctx.kit.data.flight;
    return f.state.time > f.path.start + 0.1;
  });
  await page.evaluate(() => window.__splashery.app.act());
  await expect(page.locator("#v3d-walk")).toBeVisible();
  await page.evaluate(() => window.__splashery.app.chooseToy("diamond"));
  await expect(page.locator("#v3d-walk")).toHaveCount(0);
});

test("two phone thumbs move and look independently while remaining near the filmed path", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  await page.evaluate(() =>
    window.__splashery.app.setToyOptions({ source: "edinburgh", navigation: "walk" }),
  );
  const move = await page.locator('[data-pad="move"]').boundingBox();
  const look = await page.locator('[data-pad="look"]').boundingBox();
  expect(move.x).toBeGreaterThanOrEqual(0);
  expect(look.x + look.width).toBeLessThanOrEqual(390);
  expect(look.x).toBeGreaterThan(move.x + move.width);
  const credit = await page.locator("#v3d-source-credit").boundingBox();
  const shelf = await page.locator("#shelf").boundingBox();
  expect(credit.x).toBeGreaterThanOrEqual(0);
  expect(credit.x + credit.width).toBeLessThanOrEqual(390);
  expect(credit.y + credit.height).toBeLessThanOrEqual(shelf.y);
  await page.waitForFunction(() => {
    const { player } = window.__splashery;
    const walk = player.proc.ctx.kit.data.walk;
    return player.camera.pose().position.every((v, k) => Math.abs(v - walk.state.pos[k]) < 1e-6);
  });
  const read = () =>
    page.evaluate(() => {
      const { player } = window.__splashery;
      return {
        pos: player.camera.pose().position,
        yaw: player.camera.cur.yaw,
        radius: player.proc.ctx.kit.data.walk.radius,
      };
    });
  const before = await read();
  const cdp = await context.newCDPSession(page);
  const points = [move, look].map((b, id) => ({ id, x: b.x + b.width / 2, y: b.y + b.height / 2 }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points.map((p, i) => ({ ...p, x: p.x + (i ? 26 : 0) })),
  });
  await page.waitForFunction(
    (p) => Math.abs(window.__splashery.player.camera.cur.yaw - p.yaw) > 0.02,
    before,
  );
  const looking = await read();
  expect(Math.hypot(...looking.pos.map((v, k) => v - before.pos[k]))).toBeLessThan(1e-5);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points.map((p, i) => ({ ...p, x: p.x + (i ? 26 : 0), y: p.y - (i ? 0 : 26) })),
  });
  await page.waitForFunction((p) => {
    const cam = window.__splashery.player.camera;
    return (
      Math.hypot(...cam.pose().position.map((v, i) => v - p.pos[i])) > 0.001 &&
      Math.abs(cam.cur.yaw - p.yaw) > 0.005
    );
  }, before);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const after = await read();
  expect(Math.hypot(...after.pos.map((v, k) => v - before.pos[k]))).toBeGreaterThan(0.001);
  expect(Math.abs(after.yaw - before.yaw)).toBeGreaterThan(0.005);
  const distance = await page.evaluate(async () => {
    const { closestPathPoint } = await import("./src/video3d/walk.js");
    const { player } = window.__splashery;
    const cams = JSON.parse(
      await (await fetch("./assets/toys/video-3d/edinburgh.json")).text(),
    ).cams;
    const { sceneFromPly } = await import("./src/packs/video3d.js");
    const ply = new Uint8Array(
      await (await fetch("./assets/toys/video-3d/edinburgh.ply")).arrayBuffer(),
    );
    return closestPathPoint(sceneFromPly(ply, cams).path, player.camera.pose().position).distance;
  });
  expect(distance).toBeLessThanOrEqual(after.radius + 1e-6);
  await page.screenshot({ path: "assets/toys/video-3d/review/phone-walk.png" });
  await context.close();
});
