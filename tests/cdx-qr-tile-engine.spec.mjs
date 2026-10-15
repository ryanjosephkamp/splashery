import { test, expect } from "@playwright/test";

test("A render-tail hold stops idle drawing while explicit captures and nested holds work", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const player = window.__splashery.player,
      stage = player.stage;
    player.setPaused(true);
    while (stage.graveyard.length) await new Promise(requestAnimationFrame);
    let draws = 0;
    stage.app.on("prerender", () => draws++);
    const first = stage.holdRenderTail(),
      second = stage.holdRenderTail();
    const shot = await stage.captureFrame(32, 32);
    const captured = draws;
    await new Promise((resolve) => setTimeout(resolve, 160));
    const idle = draws - captured;
    first();
    first(); // Releasing a hold twice cannot release its sibling.
    const explicitFrame = new Promise((resolve) => stage.app.once("prerender", resolve));
    stage.requestRender();
    await explicitFrame;
    await new Promise((resolve) => setTimeout(resolve, 160));
    const explicit = draws - captured;
    const beforeRelease = draws;
    const resumed = new Promise((resolve) => stage.app.once("prerender", () => resolve(true)));
    second();
    const didResume = await Promise.race([
      resumed,
      new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);
    return {
      width: shot.width,
      height: shot.height,
      captured,
      idle,
      explicit,
      resumed: didResume && draws > beforeRelease,
      holds: stage.renderTailPauses,
    };
  });
  expect(result).toMatchObject({
    width: 32,
    height: 32,
    idle: 0,
    explicit: 1,
    resumed: true,
    holds: 0,
  });
  expect(result.captured).toBeGreaterThan(0);
});

for (const renderer of ["webgl2", "webgpu"])
  for (const kernel of ["gaussian", "sharp"])
    test(`Opt-in photo tiles keep opaque colors, rotate their patches, and clean up (${renderer}, ${kernel})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/?renderer=${renderer}&adapt=off&profile=low&labs=1&kernel=${kernel}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
      const device = await page.evaluate(() => window.__splashery.player.stage.deviceType);
      test.skip(device !== renderer, `No ${renderer} adapter in this browser.`);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const result = await page.evaluate(async () => {
        const { app: a } = window.__splashery,
          { RECIPES } = await import("/src/packs/qr-craft.js"),
          original = RECIPES["qr-picture"],
          canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ff0000";
        context.fillRect(0, 0, 32, 64);
        context.fillStyle = "#0000ff";
        context.fillRect(32, 0, 32, 64);
        let tilted = false,
          tiles = true,
          opacity = 1;
        const photoFrame = a.player.photoFrame.bind(a.player);
        a.player.photoFrame = (info, uniforms) => {
          if (tiles) uniforms.uSpBodyQ = [0, Math.sin(0.35), 0, Math.cos(0.35)];
          return photoFrame(info, uniforms);
        };
        RECIPES["qr-picture"] = {
          options: [
            { key: "tilt", type: "range", min: 0, max: 1, step: 1, default: 0 },
            { key: "opacity", type: "range", min: 0, max: 1, step: 0.1, default: 1 },
            { key: "tiles", type: "range", min: 0, max: 1, step: 1, default: 1 },
            { key: "limit", type: "range", min: 0, max: 1, step: 1, default: 0 },
          ],
          splatLimit: (o, budget) => (Number(o.limit) > 0.5 ? 11 : budget),
          build(k, o) {
            tilted = Number(o.tilt) > 0.5;
            opacity = Number(o.opacity);
            tiles = Number(o.tiles) > 0.5;
            k.reach([0.6, 0.6, 1.2]);
            k.reach([-0.6, -0.6, -0.1]);
            k.cloud({ share: 1 / k.count, jitter: 0, pattern: false }, () => ({
              p: [0, 0, 0],
              scales: [0.26, 0.26, 0.004],
              quat: [0, 0, 0, 1],
              color: [1, 1, 1],
              opacity,
              photo: true,
              params: [1, 0],
              pattern: false,
            }));
          },
          photo: {
            rect: () => [-0.5, -0.5, 0.5, 0.5],
            version: () => canvas,
            source: () => canvas,
            tiles: () => [tiles ? 1 : 0, tilted ? 0.4 * Math.cbrt(0.25 / 4) : 0, 0, 0],
          },
          gpuField(o, fit) {
            const turn = Number(o.tilt) > 0.5,
              lift = turn ? 1.2 * Math.sin(Math.PI / 4) * fit.scale : 0,
              y = turn ? Math.sin(-0.35) : 0,
              w = turn ? Math.cos(-0.35) : 1;
            return {
              photo: true,
              glsl: `uniform vec4 uSpPhotoMap;
void modifySplatCenter(inout vec3 c) {
  vec2 uv = vec2(uSpPhotoMap.x * c.x + uSpPhotoMap.y, uSpPhotoMap.z * c.y + uSpPhotoMap.w);
  uvec2 q = uvec2(clamp(uv, 0.0, 1.0) * 65533.0 + 1.5);
  spPhotoOut = q.x | (q.y << 16u);
  c.z += ${lift.toFixed(8)};
}
void modifySplatRotationScale(vec3 a, vec3 b, inout vec4 rotation, inout vec3 scale) { rotation = vec4(0.0, ${y.toFixed(8)}, 0.0, ${w.toFixed(8)}); }
void modifySplatColor(vec3 c, inout vec4 color) { }`,
              wgsl: `uniform uSpPhotoMap: vec4f;
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let uv = vec2f(uniform.uSpPhotoMap.x * (*center).x + uniform.uSpPhotoMap.y, uniform.uSpPhotoMap.z * (*center).y + uniform.uSpPhotoMap.w);
  let q = vec2u(clamp(uv, vec2f(0.0), vec2f(1.0)) * 65533.0 + 1.5);
  spPhotoOut = q.x | (q.y << 16u);
  *center += vec3f(0.0, 0.0, ${lift.toFixed(8)});
}
fn modifySplatRotationScale(a: vec3f, b: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) { *rotation = vec4f(0.0, ${y.toFixed(8)}, 0.0, ${w.toFixed(8)}); }
fn modifySplatColor(c: vec3f, color: ptr<function, vec4f>) { }`,
            };
          },
        };
        const capture = async () =>
          a.withCapture([256, 256], async () => {
            const pose = { yaw: 0, pitch: 0, roll: 0, distance: 3 };
            await a.player.renderAt(a.player.time, pose);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const shot = await a.player.renderAt(a.player.time, pose),
              data = shot.getContext("2d").getImageData(0, 0, 256, 256).data;
            let x0 = 256,
              y0 = 256,
              x1 = 0,
              y1 = 0,
              opaque = 0,
              minGreen = 255;
            for (let y = 0; y < 256; y++)
              for (let x = 0; x < 256; x++) {
                const q = (y * 256 + x) * 4;
                minGreen = Math.min(minGreen, data[q + 1]);
                if (data[q + 1] < 200 && Math.abs(data[q] - data[q + 2]) > 80) {
                  x0 = Math.min(x0, x);
                  x1 = Math.max(x1, x);
                  y0 = Math.min(y0, y);
                  y1 = Math.max(y1, y);
                  if (data[q + 1] < 10) opaque++;
                }
              }
            return { width: x1 - x0 + 1, height: y1 - y0 + 1, opaque, minGreen };
          });
        try {
          await a.chooseToy("qr-picture");
          const enabled = !!a.player.stage.photo && a.player.stage.toy.photo;
          await a.setToyOptions({ tiles: 0 });
          const ordinaryBefore = await capture();
          await a.setToyOptions({ tiles: 1 });
          const flat = await capture();
          const stage = a.player.stage,
            requestRender = stage.requestRender.bind(stage);
          let requested = 0;
          stage.requestRender = () => requested++;
          const uniforms = {
            map: [1, 0, 1, 0],
            tu: [1, 0, 0, 0],
            tv: [0, 1, 0, 0],
            k: [1, 64, 64, 0],
          };
          stage.setPhotoUniforms(uniforms);
          const first = requested;
          stage.setPhotoUniforms(uniforms);
          const unchanged = requested;
          uniforms.map[0] = 2;
          stage.setPhotoUniforms(uniforms);
          const changed = requested;
          stage.requestRender = requestRender;
          const originalCount = a.player.proc.ctx.kit.count;
          await a.setToyOptions({ limit: 1 });
          const limited = await capture(),
            limitedCount = a.player.proc.ctx.kit.count;
          await a.setToyOptions({ tilt: 1 });
          const turned = await capture();
          await a.setToyOptions({ tilt: 0, opacity: 0.6 });
          const translucent = await capture();
          await a.setToyOptions({ opacity: 1, tiles: 0 });
          const ordinary = await capture();
          RECIPES["qr-picture"] = original;
          await a.chooseToy("qr-build");
          return {
            enabled,
            flat,
            limited,
            originalCount,
            redraws: { first, unchanged, changed },
            limitedCount,
            turned,
            translucent,
            ordinary,
            ordinaryBefore,
            cleaned: !a.player.stage.photo && !a.player.stage.toy.photo,
          };
        } finally {
          RECIPES["qr-picture"] = original;
        }
      });
      expect(errors).toEqual([]);
      expect(result.enabled).toBe(true);
      expect(result.originalCount).toBeGreaterThan(1000);
      expect(result.redraws).toEqual({ first: 1, unchanged: 1, changed: 2 });
      expect(result.limitedCount).toBe(11);
      expect(result.limited).toEqual(result.flat);
      expect(result.flat.width).toBeGreaterThan(20);
      expect(result.flat.width / result.flat.height).toBeCloseTo(1, 1);
      expect(result.flat.opaque / (result.flat.width * result.flat.height)).toBeGreaterThan(0.85);
      expect(result.turned.width / result.turned.height).toBeCloseTo(Math.cos(0.7), 1);
      expect(result.translucent.minGreen).toBeGreaterThanOrEqual(98);
      expect(result.translucent.minGreen).toBeLessThanOrEqual(106);
      expect(result.ordinary).toEqual(result.ordinaryBefore);
      expect(result.cleaned).toBe(true);
    });
