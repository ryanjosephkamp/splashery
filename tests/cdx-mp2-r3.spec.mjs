import { test, expect } from "@playwright/test";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";
import { PNG } from "pngjs";

test("an early worker failure rejects decoding and releases long-video resources", async ({
  page,
}) => {
  await page.route("**/src/live/depth-worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "throw new Error('Injected worker failure');",
    }),
  );
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    window.__splashery = { player: { profile: "low" } };
    const m = await import("/src/packs/moving-photo.js");
    const nativeCreate = URL.createObjectURL.bind(URL),
      nativeRevoke = URL.revokeObjectURL.bind(URL);
    const active = new Set();
    URL.createObjectURL = (blob) => {
      const url = nativeCreate(blob);
      active.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      active.delete(url);
      nativeRevoke(url);
    };
    const NativeWorker = Worker;
    let failed = false,
      terminated = 0;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener("error", (e) => {
          e.preventDefault();
          failed = true;
        });
      }
      terminate() {
        terminated++;
        super.terminate();
      }
    };
    const gif = await (await fetch("/assets/toys/screen/horse.gif")).blob();
    const file = new File([gif], "horse.gif", { type: "image/gif" });
    const arrayBuffer = file.arrayBuffer.bind(file);
    file.arrayBuffer = async () => {
      while (!failed) await new Promise((r) => setTimeout(r, 10));
      return arrayBuffer();
    };
    const failures = [];
    for (const input of [
      file,
      new File(
        [await (await fetch("/assets/toys/moving-photo-3d/bunny-long.webm")).blob()],
        "long.webm",
        { type: "video/webm" },
      ),
    ]) {
      try {
        await m.openClip(input, input.name);
        failures.push("opened");
      } catch (error) {
        failures.push(error.message);
      }
    }
    return { failures, active: active.size, terminated };
  });
  expect(result.failures).toEqual([
    "The depth model couldn't start in this browser.",
    "The depth model couldn't start in this browser.",
  ]);
  expect(result.active).toBe(0);
  expect(result.terminated).toBeGreaterThanOrEqual(2);
});

for (const revisit of [false, true]) {
  test(
    revisit
      ? "returning to a toy cannot revive its abandoned first upload"
      : "changing toys before an upload's first answer releases the paused player",
    async ({ page }) => {
      await openRender(page);
      await page.evaluate(async () => {
        const m = window.__mp3,
          pl = window.__splashery.player;
        pl.frozen = false;
        pl.setPaused(false);
        const blob = await (await fetch("/assets/toys/screen/horse.gif")).blob();
        const file = new File([blob], "horse.gif", { type: "image/gif" });
        const arrayBuffer = file.arrayBuffer.bind(file);
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        window.__releaseOpening = release;
        file.arrayBuffer = async () => {
          await gate;
          return arrayBuffer();
        };
        window.__opening = m.MOVING_PHOTO.input.read("", file.name, file).then(
          () => "committed",
          (error) => error.name,
        );
      });
      expect(await page.evaluate(() => window.__splashery.player.paused)).toBe(true);
      expect(await page.evaluate(() => window.__mp3.MOVING.pending)).toBe(null);
      await page.evaluate(() => window.__splashery.app.chooseToy("blob"));
      await page.waitForFunction(() => !window.__splashery.player.paused);
      if (revisit) {
        await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
        await page.waitForFunction(() => !window.__splashery.player.loading);
      }
      const result = await page.evaluate(async () => {
        window.__releaseOpening();
        const outcome = await window.__opening;
        return {
          outcome,
          paused: window.__splashery.player.paused,
          custom: !!window.__mp3.MOVING.custom,
          pending: !!window.__mp3.MOVING.pending,
          opening: window.__mp3.MOVING.opening,
        };
      });
      expect(result).toEqual({
        outcome: "AbortError",
        paused: false,
        custom: false,
        pending: false,
        opening: false,
      });
    },
  );
}

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

test("Bunny's full projected picture has no introduced white rim pixels", async ({ page }) => {
  test.setTimeout(180_000);
  await openRender(page, { id: "sample", source: "assets/toys/screen/bunny.mp4" });
  for (const time of [
    0.01025, 0.052083333333333336, 0.34375, 0.42708375, 0.75, 1.05208375, 2.5, 4.25,
    4.385416666666667,
  ]) {
    const r = await renderFrame(page, time);
    expect(r.pixels).toBeGreaterThan(10000);
    expect(r.edgeSpecks, `at ${time} seconds`).toBe(0);
    expect(r.holes, `at ${time} seconds`).toBe(0);
  }
});

test("an edge-on wall in the long machine film samples only its observed patch", async ({
  page,
}) => {
  await openRender(page, { id: "machine-long", stepped: true });
  for (const time of [22.385583333333333, 22.42725, 22.468916666666665]) {
    const r = await renderFrame(page, time);
    expect(r.pixels).toBeGreaterThan(10000);
    expect(r.sourcePixelsVerified).toBe(true);
    expect(r.holes, `at ${time} seconds`).toBe(0);
    expect(r.edgeSpecks, `at ${time} seconds`).toBe(0);
  }
});

test("a cached long sample presents its own frame zero when revisited", async ({ page }) => {
  await openRender(page, { id: "sample-long" });
  await renderFrame(page, 5);
  await page.evaluate(async () => {
    const m = window.__mp3;
    await window.__splashery.app.setToyOptions({ clip: "machine" });
    const long = m.MOVING.samples.get("sample-long");
    await m.loadSample("sample-long", async (clip) => {
      await (
        await import("/src/packs/photo-sharp.js")
      ).presentSharpClip(
        { ...m.MOVING, clip, frame: 0, t: 0, opening: true },
        { width: 2, height: (2 * clip.h) / clip.w, full: m.MOVING.full },
      );
      await window.__splashery.player.stage.captureFrame();
    });
    window.__previewAt = window.__psv.state().videoTime;
    window.__previewClock = long.video.currentTime;
  });
  expect(await page.evaluate(() => window.__previewClock)).toBeLessThan(0.01);
  expect(await page.evaluate(() => window.__previewAt)).toBeLessThan(0.01);
});

test("a thin foreground surface keeps its source pixels beside a depth step", async ({ page }) => {
  await openRender(page);
  await page.evaluate(async () => {
    const m = window.__mp3,
      w = 128,
      h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const depth = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const front = x >= 48 && x < 80 && y >= 12 && y < 52;
        rgba.set(front ? [20, 210, 20, 255] : [140, 20, 20, 255], (y * w + x) * 4);
        depth[y * w + x] = front ? 0.8 : 0.2;
      }
    m.MOVING.custom = m.makeClip(
      "Foreground step",
      w,
      h,
      [
        { data: rgba, delay: 500 },
        { data: rgba, delay: 500 },
      ],
      [depth, depth],
    );
    await window.__splashery.app.setToyOptions({ clip: "custom" });
    window.__mp3Canvas.width = m.MOVING.grid.cols * 2;
    window.__mp3Canvas.height = m.MOVING.grid.rows;
  });
  const r = await renderFrame(page, 0, { yaw: 0, evidence: true });
  const plain = PNG.sync.read(Buffer.from(r.picture.split(",")[1], "base64"));
  const source = PNG.sync.read(Buffer.from(r.reference.split(",")[1], "base64"));
  let expected = 0,
    preserved = 0;
  for (let i = 0; i < source.data.length; i += 4)
    if (source.data[i + 1] > 180 && source.data[i] < 50) {
      expected++;
      preserved += plain.data[i + 1] > 150 && plain.data[i] < 80;
    }
  expect(expected).toBeGreaterThan(1000);
  expect(preserved / expected).toBeGreaterThan(0.98);
});

test("the moving relief's completed cut pixels render on WebGPU", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await openRender(page, { renderer: "webgpu" });
  expect(await page.evaluate(() => window.__splashery.player.stage.deviceType)).toBe("webgpu");
  expect(await page.evaluate(() => window.__psv.state().on)).toBe(true);
  const r = await renderFrame(page, 0.75);
  expect(errors).toEqual([]);
  expect(r.pixels).toBeGreaterThan(10000);
  expect(r.holes).toBe(0);
  expect(r.edgeSpecks).toBe(0);
});

test("an oblique one-pixel foreground strip survives between the intact surface cells", async ({
  page,
}) => {
  await openRender(page);
  await page.evaluate(async () => {
    const m = window.__mp3,
      w = 480,
      h = 270;
    const rgba = new Uint8ClampedArray(w * h * 4),
      depth = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const front = x === 319 && y >= 60 && y < 210;
        rgba.set(front ? [20, 240, 20, 255] : [140, 20, 20, 255], (y * w + x) * 4);
        depth[y * w + x] = front ? 0.8 : 0.2;
      }
    m.MOVING.custom = m.makeClip(
      "Thin foreground",
      w,
      h,
      [
        { data: rgba, delay: 500 },
        { data: rgba, delay: 500 },
      ],
      [depth, depth],
    );
    await window.__splashery.app.setToyOptions({ clip: "custom" });
    window.__mp3Canvas.width = m.MOVING.grid.cols * 2;
    window.__mp3Canvas.height = m.MOVING.grid.rows;
  });
  const r = await renderFrame(page, 0, { yaw: 0.65, evidence: true });
  const corners = await page.evaluate(() => {
    const pl = window.__splashery.player,
      st = pl.stage;
    const mi = st.app.scene.layers
      .getLayerByName("World")
      .meshInstances.find(
        (m) => m.node.name === "psv-relief" && m.material.parameters.uLayer?.data[2] === 0,
      );
    const grid = mi.material.parameters.uGrid.data,
      lift = mi.material.parameters.uLift.data;
    return [
      [319.1, 61],
      [319.9, 61],
      [319.9, 209],
      [319.1, 209],
    ].map(([x, y]) => {
      const p = pl.screenPoint([
        (x / 480 - 0.5) * grid[0],
        (0.5 - y / 270) * grid[1],
        lift[0] * (0.8 - lift[1]),
      ]);
      return p.slice(0, 2).map((v) => v * st.pixelRatio());
    });
  });
  const plain = PNG.sync.read(Buffer.from(r.picture.split(",")[1], "base64"));
  let expected = 0,
    preserved = 0;
  for (let y = 0; y < plain.height; y++)
    for (let x = 0; x < plain.width; x++) {
      const cross = corners.map(([a, b], i) => {
        const [c, d] = corners[(i + 1) % 4];
        return (c - a) * (y + 0.5 - b) - (d - b) * (x + 0.5 - a);
      });
      if (!cross.every((v) => v >= 0) && !cross.every((v) => v <= 0)) continue;
      expected++;
      const i = (y * plain.width + x) * 4;
      preserved += plain.data[i + 1] > plain.data[i] + 15;
    }
  expect(expected).toBeGreaterThan(10);
  expect(preserved / expected).toBeGreaterThan(0.95);
});

test("selecting another sample cancels an uncommitted long-upload preview", async ({ page }) => {
  await openRender(page);
  await page.evaluate(async () => {
    const m = window.__mp3;
    const blob = await (await fetch("/assets/toys/moving-photo-3d/bunny-long.webm")).blob();
    window.__opening = m.MOVING_PHOTO.input
      .read("", "old.webm", new File([blob], "old.webm", { type: blob.type }))
      .then(
        () => "committed",
        (e) => e.name,
      );
  });
  await page.waitForFunction(() => !!window.__mp3.MOVING.pending);
  const result = await page.evaluate(async () => {
    const m = window.__mp3,
      pending = m.MOVING.pending;
    await window.__splashery.app.setToyOptions({ clip: "machine" });
    return {
      outcome: await window.__opening,
      cancelled: pending.job.cancelled,
      selected: m.MOVING.clip.sample,
      custom: m.MOVING.custom?.name,
      pending: !!m.MOVING.pending,
    };
  });
  expect(result).toEqual({
    outcome: "AbortError",
    cancelled: true,
    selected: "machine",
    custom: undefined,
    pending: false,
  });
});

test("a long upload presents its first depth answer while the four-answer opening continues", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    window.__splashery = { player: { profile: "low" } };
    const m = await import("/src/packs/moving-photo.js");
    const blob = await (await fetch("/assets/toys/moving-photo-3d/bunny-long.webm")).blob();
    const previews = [];
    const clip = await m.openClip(
      new File([blob], "bunny-long.webm", { type: blob.type }),
      "long",
      null,
      (c) =>
        previews.push({
          answers: c.depth.done,
          mean: [...c.mean].every(Number.isFinite),
          range: Math.max(...c.mean) - Math.min(...c.mean),
        }),
    );
    const answers = clip.depth.done;
    clip.job.cancel();
    clip.video.pause();
    clip.audio?.track.close();
    URL.revokeObjectURL(clip.url);
    return { previews, answers };
  });
  expect(result.previews).toHaveLength(1);
  expect(result.previews[0].answers).toBe(1);
  expect(result.previews[0].mean).toBe(true);
  expect(result.previews[0].range).toBeGreaterThan(0.05);
  expect(result.answers).toBeGreaterThanOrEqual(4);
});

test("a slow long preview keeps the opening mean of the original first four answers", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    window.__splashery = { player: { profile: "low" } };
    const m = await import("/src/packs/moving-photo.js");
    const { longNear } = m;
    const blob = await (await fetch("/assets/toys/moving-photo-3d/bunny-long.webm")).blob();
    let first;
    const c = await m.openClip(
      new File([blob], "bunny-long.webm", { type: blob.type }),
      "long",
      null,
      async (p) => {
        first = p.depth;
        while (first.done < 6 && !p.job.done) await new Promise((r) => setTimeout(r, 20));
        p.job.cancel();
      },
    );
    const expected = new Float32Array(c.w * c.h),
      one = new Float32Array(c.w * c.h);
    // At a depth answer's center, longNear returns that exact cached answer.
    const saved = c.depth;
    c.depth = first;
    for (let i = 0; i < 4; i++) {
      const bytes = c.shownDepth((i + 0.5) / first.rate);
      for (let p = 0; p < bytes.length; p++) expected[p] += bytes[p] / 255 / 4;
    }
    c.depth = saved;
    let maxError = 0;
    for (let p = 0; p < expected.length; p++)
      maxError = Math.max(maxError, Math.abs(expected[p] - c.mean[p]));
    c.video.pause();
    c.audio?.track.close();
    URL.revokeObjectURL(c.url);
    return { answers: first.done, maxError };
  });
  expect(result.answers).toBeGreaterThanOrEqual(6);
  expect(result.maxError).toBeLessThan(1 / 255 + 0.000001);
});

test("a prepared short sample offers a real first-frame relief before completing all depth frames", async ({
  page,
}) => {
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    window.__splashery = { player: { profile: "low" } };
    const m = await import("/src/packs/moving-photo.js");
    const previews = [];
    const c = await m.loadSample("machine", (p) =>
      previews.push({
        n: p.n,
        length: p.near[0].length,
        dimensions: [p.w, p.h],
        nativeColor: [p.previewColor.w, p.previewColor.h, p.previewColor.data.length],
        range:
          p.near[0].reduce((v, x) => Math.max(v, x), 0) -
          p.near[0].reduce((v, x) => Math.min(v, x), 255),
      }),
    );
    c.audio?.track.close();
    return { previews, n: c.n, dimensions: [c.w, c.h] };
  });
  expect(result.previews).toHaveLength(1);
  expect(result.previews[0].n).toBe(1);
  const preview = result.previews[0];
  expect(preview.length).toBe(preview.dimensions[0] * preview.dimensions[1]);
  expect(Math.max(...preview.dimensions)).toBeLessThanOrEqual(160);
  expect(preview.nativeColor).toEqual([480, 270, 480 * 270 * 4]);
  expect(result.dimensions).toEqual([480, 270]);
  expect(result.previews[0].range).toBeGreaterThan(30);
  expect(result.n).toBe(96);
});

test("the bridge's projecting walkway leaves no holes or bright rim gaps", async ({ page }) => {
  await openRender(page, { id: "bridge" });
  for (const time of [0.015625, 4.203125]) {
    const r = await renderFrame(page, time);
    expect(r.pixels).toBeGreaterThan(10000);
    expect(r.holes, `at ${time} seconds`).toBe(0);
    expect(r.edgeSpecks, `at ${time} seconds`).toBe(0);
  }
});

// This checks visible geometry independently of the source-brightness witness.
test("flat depth does not acquire colored thickness outside its projected picture", async ({
  page,
}) => {
  await openRender(page);
  await page.evaluate(async () => {
    const m = window.__mp3,
      w = 160,
      h = 90;
    const rgba = new Uint8ClampedArray(w * h * 4),
      depth = new Float32Array(w * h).fill(0.5);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        rgba.set((x + y) % 2 ? [255, 255, 255, 255] : [20, 20, 20, 255], (y * w + x) * 4);
    m.MOVING.custom = m.makeClip(
      "Flat border",
      w,
      h,
      [
        { data: rgba, delay: 500 },
        { data: rgba, delay: 500 },
      ],
      [depth, depth],
    );
    await window.__splashery.app.setToyOptions({ clip: "custom" });
    window.__mp3Canvas.width = m.MOVING.grid.cols * 2;
    window.__mp3Canvas.height = m.MOVING.grid.rows;
  });
  const r = await renderFrame(page, 0, { yaw: 0.65, evidence: true, frame: false });
  const plain = PNG.sync.read(Buffer.from(r.picture.split(",")[1], "base64"));
  const reference = PNG.sync.read(Buffer.from(r.reference.split(",")[1], "base64"));
  let thick = 0;
  for (let y = 0; y < plain.height; y++)
    for (let x = 0; x < plain.width; x++) {
      const at = (y * plain.width + x) * 4;
      if (plain.data[at + 3] < 128 || reference.data[at + 3] >= 128) continue;
      let adjacent = false;
      // Allow one raster pixel at the same geometric outline, never a wall.
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < plain.width && yy < plain.height)
            adjacent ||= reference.data[(yy * plain.width + xx) * 4 + 3] >= 128;
        }
      thick += !adjacent;
    }
  expect(r.pixels).toBeGreaterThan(10000);
  expect(thick).toBe(0);
});

test("clip geometry follows its clock in the same render frame after the drive returns", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__psv?.state().on && !window.__splashery.player.loading);
  await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "horse" }));
  await page.evaluate(async () => {
    window.__clockMoving = await import("/src/packs/moving-photo.js");
  });
  await page.waitForFunction(() => {
    const c = window.__clockMoving.MOVING.clip;
    const depth = window.__psv.state().depth;
    return (
      c?.sample === "horse" &&
      !window.__splashery.player.loading &&
      depth?.[0] === c.w &&
      depth?.[1] === c.h
    );
  });
  const result = await page.evaluate(async () => {
    const { MOVING } = await import("/src/packs/moving-photo.js");
    const { app, player } = window.__splashery;
    const recipe = player.motion.recipe;
    const original = recipe.drive;
    const surface = player.stage.app.scene.layers
      .getLayerByName("World")
      .meshInstances.find(
        (mi) => mi.node.name === "psv-relief" && mi.material.parameters.uLayer?.data[2] === 0,
      );
    const texture = surface.material.parameters.uDepth.data;
    const lock = texture.lock;
    let inDrive = false,
      uploads = 0,
      inline = 0,
      compared = 0,
      mismatches = 0;
    recipe.drive = function (...args) {
      inDrive = true;
      try {
        return original.apply(this, args);
      } finally {
        inDrive = false;
      }
    };
    texture.lock = function (...args) {
      uploads++;
      inline += inDrive;
      return lock.apply(this, args);
    };
    const rendered = () => {
      const actual = texture.getSource();
      const expected = MOVING.clip.shownDepth?.(MOVING.frame) || MOVING.clip.near[MOVING.frame];
      compared++;
      mismatches += actual.length !== expected.length || actual.some((v, i) => v !== expected[i]);
    };
    player.stage.app.on("frameend", rendered);
    try {
      app.setControl("play", 1);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return { uploads, inline, compared, mismatches };
    } finally {
      recipe.drive = original;
      texture.lock = lock;
      player.stage.app.off("frameend", rendered);
    }
  });
  console.log(JSON.stringify(result));
  expect(result.uploads).toBeGreaterThan(2);
  expect(result.inline).toBe(0);
  expect(result.compared).toBeGreaterThan(2);
  expect(result.mismatches).toBe(0);
});
