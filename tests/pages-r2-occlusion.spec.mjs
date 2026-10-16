// Task 95 review: hidden book parts must not show through a moving cover.
import { test, expect } from "@playwright/test";

for (const renderer of ["webgl2", "webgpu"])
  for (const toy of ["your-book", "photo-album"])
    test(`${toy}: the turning cover occludes its pages (${renderer})`, async ({ page }) => {
      test.setTimeout(360000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
      expect(await page.evaluate(() => window.__splashery.player.stage.device.deviceType)).toBe(
        renderer,
      );
      await page.evaluate(async (toy) => {
        const { app } = window.__splashery;
        await app.chooseToy(toy);
        if (toy === "your-book")
          await app.openMedia(new URL("/tests/fixtures/bk/booklet.pdf", location.href).href);
      }, toy);
      await page.waitForFunction(
        () => {
          const p = window.__splashery.player;
          p.stage.requestRender();
          const pics = p.pictures;
          return (
            pics?.media &&
            pics.splats() > 0 &&
            pics.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
          );
        },
        null,
        { timeout: 180000 },
      );
      const result = await page.evaluate(async () => {
        const p = window.__splashery.player;
        p.frozen = true;
        p.glide = null;
        p.camera.cur.yaw = p.camera.tgt.yaw = 0.22;
        p.camera.cur.pitch = p.camera.tgt.pitch = 0.08;
        p.camera.interact();
        p.act();
        for (let i = 0; i < 20 && !(p.motion.out.parts.cover?.angle > 0.25); i++) {
          p.time += 0.1;
          for (let j = 0; j < 3; j++) await p.stage.captureFrame();
        }
        const cover = p.proc.ctx.parts.findIndex((x) => x.name === "cover");
        if (cover < 1) throw new Error("The cover must be an independently moving part.");
        const { buf } = p.proc.ctx;
        const u = p.stage.sheetUniforms;
        const q = u.uSpBodyQ,
          t = u.uSpBodyT,
          c = u.uSpToy;
        const points = [];
        for (let i = 0; i < buf.count; i++) {
          if ((Math.round(buf.anim[i * 4]) & 15) !== cover) continue;
          const v = Array.from(
            p.proc.container.centers.slice(i * 3, i * 3 + 3),
            (v, k) => v - c[k],
          );
          const cross = (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ];
          const uv = cross(q, v);
          const uuv = cross(
            q,
            uv.map((a, k) => a + q[3] * v[k]),
          );
          const world = v.map((v, k) => v + 2 * uuv[k] + c[k] + t[k]);
          points.push(p.stage.toScreen(world));
        }
        points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        const hull = [];
        for (const v of points) {
          while (hull.length > 1 && turn(hull.at(-2), hull.at(-1), v) <= 0) hull.pop();
          hull.push(v);
        }
        const lower = hull.length;
        for (let i = points.length - 2; i >= 0; i--) {
          const v = points[i];
          while (hull.length > lower && turn(hull.at(-2), hull.at(-1), v) <= 0) hull.pop();
          hull.push(v);
        }
        hull.pop();
        const capture = async () => {
          let frame;
          for (let i = 0; i < 4; i++) frame = await p.stage.captureFrame();
          return frame;
        };
        const first = await capture(),
          control = await capture();
        const mask = document.createElement("canvas");
        mask.width = first.width;
        mask.height = first.height;
        const g = mask.getContext("2d");
        const ratio = first.width / p.canvas.clientWidth;
        g.beginPath();
        hull.forEach((v, i) =>
          i ? g.lineTo(v[0] * ratio, v[1] * ratio) : g.moveTo(v[0] * ratio, v[1] * ratio),
        );
        g.closePath();
        g.fill();
        // Leave the soft Gaussian perimeter and legitimately exposed pages outside the mask.
        g.globalCompositeOperation = "destination-out";
        g.lineWidth = 16 * ratio;
        g.stroke();
        const inside = g.getImageData(0, 0, mask.width, mask.height).data;
        const texture = p.proc.container.getTexture("dataColor");
        const color = texture.lock();
        for (let i = 0; i < buf.count; i++)
          if ((Math.round(buf.anim[i * 4]) & 15) !== cover) color[i * 4 + 3] = 0;
        texture.unlock();
        for (const s of p.pictures.sheets)
          if (s.def.id !== "cover" && s.slot) {
            s.slot.entity.gsplat.enabled = false;
            if (s.slot.surface) {
              const m = s.slot.surface.material;
              m.redWrite = m.greenWrite = m.blueWrite = m.alphaWrite = m.depthWrite = false;
              m.update();
            }
          }
        const only = await capture();
        const pixels = (f) => f.getContext("2d").getImageData(0, 0, f.width, f.height).data;
        const a = pixels(first),
          b = pixels(control),
          d = pixels(only);
        let delta = 0,
          noise = 0,
          count = 0;
        for (let i = 0; i < a.length; i += 4)
          if (inside[i + 3] === 255) {
            for (let k = 0; k < 3; k++) {
              delta += Math.abs(b[i + k] - d[i + k]);
              noise += Math.abs(a[i + k] - b[i + k]);
            }
            count++;
          }
        return {
          mean: delta / (count * 3),
          noise: noise / (count * 3),
          count,
          angle: p.motion.out.parts.cover.angle,
        };
      });
      console.log("Cover occlusion:", toy, renderer, JSON.stringify(result));
      expect(result.angle).toBeGreaterThan(0.25);
      expect(result.angle).toBeLessThan(0.5);
      expect(result.count).toBeGreaterThan(1000);
      expect(result.mean - result.noise).toBeLessThan(0.5);
    });

for (const renderer of ["webgl2", "webgpu"])
  test(`all bindings and album covers keep full turns inside the sortable volume (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(600000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    expect(await page.evaluate(() => window.__splashery.player.stage.device.deviceType)).toBe(
      renderer,
    );
    const cases = [
      ...["hardcover", "paperback", "magazine", "spiral", "stapled"].map((style) => ({
        toy: "your-book",
        key: "style",
        value: style,
      })),
      ...["leather", "linen", "scrapbook"].map((value) => ({
        toy: "photo-album",
        key: "cover",
        value,
      })),
    ];
    const results = [];
    for (const item of cases) {
      await page.evaluate(async ({ toy, key, value }) => {
        const { app, player: p } = window.__splashery;
        p.frozen = false;
        await app.chooseToy(toy);
        await app.setToyOption(key, value);
        if (toy === "your-book")
          await app.openMedia(new URL("/tests/fixtures/bk/booklet.pdf", location.href).href);
      }, item);
      await page.waitForFunction(
        ({ key, value }) => {
          const p = window.__splashery.player;
          p.stage.requestRender();
          return (
            !p.loading &&
            p.proc?.ctx.kit.options[key] === value &&
            p.pictures?.media &&
            p.pictures.splats() > 0
          );
        },
        item,
        { timeout: 180000 },
      );
      const result = await page.evaluate(async ({ toy, value }) => {
        const p = window.__splashery.player;
        p.frozen = true;
        let moving = 0,
          inspected = 0,
          captureDraws = 0;
        const failures = [];
        const destinations = toy === "photo-album" ? [1, 2, 0, "close"] : [1, 2, 0];
        for (const destination of destinations) {
          if (destination === "close") p.act(p.fromRecipe([-0.3, 0, 0.02]));
          else p.pictures.go(destination);
          for (let frame = 0; frame < 20; frame++) {
            p.time += 0.125;
            p.camera.update(0.125);
            // Bounds are computed by the CPU pose pass. Inspect every pose;
            // submit a completed GPU draw every fourth sample as well.
            p.update(0);
            if (frame % 4 === 0) {
              await p.stage.captureFrame();
              captureDraws++;
            }
            p.resortPose();
            const b = p.stage.toy.entity.gsplat.customAabb;
            const lo = b.getMin(),
              hi = b.getMax();
            const min = [lo.x, lo.y, lo.z],
              max = [hi.x, hi.y, hi.z];
            const centers = p.proc.container.centers;
            for (let i = 0; i < p.proc.ctx.buf.count; i++)
              for (let k = 0; k < 3; k++) {
                const v = centers[i * 3 + k];
                if ((v < min[k] - 1e-6 || v > max[k] + 1e-6) && failures.length < 5)
                  failures.push({ destination, frame, axis: k, v, min: min[k], max: max[k] });
              }
            const out = p.motion.out;
            if (
              (out.parts.cover?.angle > 0.05 && out.parts.cover.angle < Math.PI - 0.05) ||
              out.leaves?.some((l) => l.angle > 0.05 && l.angle < Math.PI - 0.05)
            )
              moving++;
            inspected++;
          }
        }
        const out = p.motion.out;
        const cover = out.parts.cover?.angle ?? out.leaves[value === "stapled" ? 0 : 8]?.angle;
        return { failures, moving, inspected, captureDraws, cover };
      }, item);
      results.push({ ...item, ...result });
      expect(result.failures, JSON.stringify(item)).toEqual([]);
      expect(result.moving, JSON.stringify(item)).toBeGreaterThan(4);
      expect(result.inspected).toBe(item.toy === "photo-album" ? 80 : 60);
      expect(result.captureDraws).toBe(item.toy === "photo-album" ? 20 : 15);
      expect(result.cover).toBe(0);
    }
    console.log("Complete book turn volumes:", renderer, JSON.stringify(results));
    expect(results).toHaveLength(8);
  });
