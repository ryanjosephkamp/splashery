// Lane Photo fidelity's engine change: photo-textured splats (src/photo-splats.js). A photo toy's
// marked splats take their colors from the photo at each pixel they cover, so a picture of text
// stays legible; every other toy renders exactly as before.

import { test, expect } from "@playwright/test";
import { photoUniforms, withPhotoPS, PHOTO_WRITE } from "../src/photo-splats.js";
import { MODIFIER_KIT, MODIFIER_KIT_PHOTO } from "../src/effects.js";
import { kernelChunks } from "../src/kernels.js";

test("the mapping: the picture's corners are (0, 0) and (1, 1), and its axes turn with the toy", () => {
  const u = photoUniforms({ x0: -1, x1: 1, y0: -0.5, y1: 1.5 });
  const uv = (x, y) => [u.map[0] * x + u.map[1], u.map[2] * y + u.map[3]];
  expect(uv(-1, 1.5)).toEqual([0, 0]);
  expect(uv(1, -0.5)).toEqual([1, 1]);
  expect(u.tu).toEqual([2, 0, 0, 0]);
  expect(u.tv).toEqual([0, -2, 0, 0]);
  // A quarter turn about y: the picture's x axis points along -z.
  const s = Math.SQRT1_2;
  const t = photoUniforms({ x0: 0, x1: 1, y0: 0, y1: 1 }, [0, s, 0, s]);
  expect(t.tu[0]).toBeCloseTo(0, 6);
  expect(t.tu[2]).toBeCloseTo(-1, 6);
  expect(t.tv[1]).toBeCloseTo(-1, 6);
});

test("only the photo variant of the kit's program writes the photo stream", () => {
  for (const lang of ["glsl", "wgsl"]) {
    expect(MODIFIER_KIT_PHOTO[lang]).toContain(PHOTO_WRITE[lang]);
    expect(MODIFIER_KIT[lang]).not.toContain("spPhotoOut");
    expect(MODIFIER_KIT[lang]).not.toContain("__KIT_PHOTO");
  }
  // The fragment chunk keeps the kernel's own function and runs the photo's first.
  const ps = withPhotoPS(kernelChunks("sharp"));
  expect(ps.glsl).toContain("void spKernelColor(");
  expect(ps.wgsl).toContain("fn spKernelColor(");
  expect(ps.glsl.match(/void modifySplatColor\(/g)).toHaveLength(1);
});

// A page of text (a synthetic photo, drawn here) shown flat in Photo to 3D, zoomed until it fills
// the width. Returns how closely the render matches the page (normalized correlation of the
// luminance over the middle of the page, the page resampled to the render's pixels) and what the
// stage had on.
// `fixed`: render at a fixed 390 by 600 (WebGL). On WebGPU the capture stays at the page's own size:
// PlayCanvas 2.22.3's raster renderer, which photo toys use there, drops a frame (an invalid command
// buffer) when a fixed-size capture resizes it, with or without the photo (it does so on main too,
// forced to that renderer; docs/handoff/PhotoFidelity.md, "Known issues").
async function textMatch(page, detail, fixed = true) {
  return page.evaluate(
    async ([detail, fixed]) => {
      const { app, player } = window.__splashery;
      const m = await import("/src/packs/photo-3d.js");
      await import("/src/packs/photo-sharp.js")
        .then((s) => s.setSharpView("photo-3d", "splats"))
        .catch(() => {}); // Splats, not the Sharp picture view (lane Photo sharp view)
      const W = 480;
      const H = 720;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#111";
      g.font = "15px sans-serif";
      const words = "splats each take the photo's colors at every pixel they cover so text stays sharp".split(" "); // prettier-ignore
      for (let y = 24, k = 0; y < H - 10; y += 21)
        for (let x = 10; x < W - 60; k++) {
          const w = words[k % words.length];
          g.fillText(w, x, y);
          x += g.measureText(w + " ").width;
        }
      const img = g.getImageData(0, 0, W, H);
      const photo = { w: W, h: H, data: new Uint8Array(img.data.buffer) };
      const dw = 28;
      const dh = 42;
      const depth = {
        w: dw,
        h: dh,
        d: new Float32Array(dw * dh).map((_, i) => 1 + 0.001 * (i % dw)),
      };
      m.usePhoto(photo, depth, "Text");
      // The toy's photo hook: Photo to 3D's own once the lane's toy has it; before that (the engine
      // alone) a test hook that marks the picture's splats. Either way `detail` picks plain splats.
      window.__phfPage = { a: W / H, c, plain: detail === "splats" };
      const R = m.RECIPES["photo-3d"];
      if (!R.__phfTest) {
        R.__phfTest = true;
        if (!R.photo) {
          const build = R.build;
          R.build = function (k, o) {
            const cloud = k.cloud;
            let first = true;
            k.cloud = (opts, fn) => {
              if (!first) return cloud.call(k, opts, fn);
              first = false;
              return cloud.call(k, opts, (r, i) => {
                const sp = fn(r, i);
                return sp ? { ...sp, photo: true } : sp;
              });
            };
            try {
              return build.call(this, k, o);
            } finally {
              k.cloud = cloud;
            }
          };
          const A = () => window.__phfPage.a;
          R.photo = { rect: () => [-A() / 2, -0.5, A() / 2, 0.5], version: () => 1, source: () => window.__phfPage.c }; // prettier-ignore
        }
        const on = R.photo.on;
        R.photo.on = (o) => !window.__phfPage?.plain && (on ? on(o) : true);
      }
      await app.chooseToy("photo-3d");
      // The Splats view, picked before the rebuild below (a scene saves it since lane Photo sharp
      // view r2). (A rebuild while Sharp picture shows, then Splats, draws the splats with a WebGL
      // error on main since #422: reported to the Operator, docs/handoff/PhotoFidelity.md.)
      (await import("/src/packs/photo-sharp.js")).setSharpView("photo-3d", "splats");
      await app.setToyOptions({ source: "custom", detail, view: "splats" });
      player.idle.weight = 0;
      player.motion.setControl("flat", 1, { snap: true });
      const st = player.stage;
      if (fixed) st.setFixedSize([390, 600]);
      const a = W / H;
      for (let k = 0; k < 3; k++) {
        await st.captureFrame();
        const l = player.screenPoint([-a / 2, 0, 0]);
        const r = player.screenPoint([a / 2, 0, 0]);
        const cam = player.camera;
        const cw = fixed ? 390 : st.canvas.getBoundingClientRect().width;
        cam.cur = { ...cam.cur, distance: Math.max(cam.minDistance, (cam.cur.distance * (r[0] - l[0])) / (0.95 * cw)) }; // prettier-ignore
        cam.tgt = { ...cam.cur };
      }
      await st.captureFrame();
      const frame = await st.captureFrame();
      if (fixed) st.setFixedSize(null);
      const fd = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      // Registered by the bounding box of the ink (dark pixels) in each.
      const box = (d, w, h) => {
        const b = [w, h, -1, -1];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (lum(d, (y * w + x) * 4) < 110) {
              b[0] = Math.min(b[0], x);
              b[1] = Math.min(b[1], y);
              b[2] = Math.max(b[2], x);
              b[3] = Math.max(b[3], y);
            }
        return b;
      };
      const rb = box(fd, frame.width, frame.height);
      const sb = box(img.data, W, H);
      // the page resampled onto the render's pixels (the browser's own high-quality scaling)
      const rw = rb[2] - rb[0] + 1;
      const rh = rb[3] - rb[1] + 1;
      const sc = document.createElement("canvas");
      sc.width = rw;
      sc.height = rh;
      const sg = sc.getContext("2d");
      sg.imageSmoothingQuality = "high";
      sg.drawImage(c, sb[0], sb[1], sb[2] - sb[0] + 1, sb[3] - sb[1] + 1, 0, 0, rw, rh);
      const sd = sg.getImageData(0, 0, rw, rh).data;
      const xs = [];
      const ys = [];
      for (let y = Math.round(rh * 0.3); y < rh * 0.7; y++)
        for (let x = Math.round(rw * 0.05); x < rw * 0.95; x++) {
          xs.push(lum(fd, ((rb[1] + y) * frame.width + rb[0] + x) * 4));
          ys.push(lum(sd, (y * rw + x) * 4));
        }
      const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
      const ma = mean(xs);
      const mb = mean(ys);
      let ab = 0;
      let aa = 0;
      let bb = 0;
      for (let i = 0; i < xs.length; i++) {
        ab += (xs[i] - ma) * (ys[i] - mb);
        aa += (xs[i] - ma) ** 2;
        bb += (ys[i] - mb) ** 2;
      }
      return { ncc: ab / Math.sqrt(aa * bb), n: xs.length, photo: !!st.photo, toyPhoto: !!st.toy?.photo, device: st.deviceType }; // prettier-ignore
    },
    [detail, fixed],
  );
}

async function open(page, renderer = "webgl2") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || (m.type() === "warning" && /GL_INVALID|WebGPU|Invalid/.test(m.text()))) errors.push(m.text()); // prettier-ignore
  });
  await page.goto(`/?renderer=${renderer}&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

test.describe(() => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a page of text in a photo stays legible with the photo's own pixels, and at least as well as with one color a splat", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = await open(page);
    const plain = await textMatch(page, "splats");
    expect(plain.photo).toBe(false);
    const sharp = await textMatch(page, "photo");
    expect(sharp.photo).toBe(true);
    expect(sharp.toyPhoto).toBe(true);
    expect(sharp.n).toBeGreaterThan(5000);
    // (measured October 8, 2026: 0.86 with the photo, 0.35 without; round 2's adaptive grid and
    // smaller small splats brought One color per splat up to 0.89, the photo's own pixels 0.93)
    expect(sharp.ncc).toBeGreaterThan(0.8);
    expect(plain.ncc).toBeGreaterThan(0.75);
    expect(sharp.ncc).toBeGreaterThan(plain.ncc);
    expect(errors).toEqual([]);
  });

  test("leaving a photo toy puts the renderer back as it was", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = await open(page);
    const look = () =>
      page.evaluate(async () => {
        const { player } = window.__splashery;
        const st = player.stage;
        const g = st.app.scene.gsplat;
        st.setFixedSize([200, 200]);
        for (let i = 0; i < 3; i++) await st.captureFrame();
        const f = await st.captureFrame();
        st.setFixedSize(null);
        const d = f.getContext("2d").getImageData(0, 0, f.width, f.height).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + 2 * d[i + 1] + d[i + 2];
        return {
          sum,
          stream: !!g.format.getStream("spPhoto"),
          varyings: g.varyings.streams.length,
          vs: g.material.shaderChunks.glsl.get("gsplatModifyVS") ?? null,
          renderer: g.renderer,
          photo: !!st.photo,
        };
      });
    await page.evaluate(() => window.__splashery.app.chooseToy("donut"));
    await page.evaluate(() => (window.__splashery.player.idle.weight = 0));
    const before = await look();
    await textMatch(page, "photo");
    const during = await look();
    expect(during.photo).toBe(true);
    expect(during.stream).toBe(true);
    expect(during.varyings).toBe(2);
    await page.evaluate(() => window.__splashery.app.chooseToy("donut"));
    await page.evaluate(() => (window.__splashery.player.idle.weight = 0));
    const after = await look();
    expect(after).toEqual({ ...before, sum: after.sum });
    expect(after.sum).toBeGreaterThan(0.98 * before.sum);
    expect(after.sum).toBeLessThan(1.02 * before.sum);
    expect(errors).toEqual([]);
  });

  test("it compiles and draws on WebGPU too", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = await open(page, "webgpu");
    const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
    test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
    const sharp = await textMatch(page, "photo", false);
    expect(sharp.device).toBe("webgpu");
    expect(sharp.ncc).toBeGreaterThan(0.8);
    expect(errors).toEqual([]);
  });
});
