// Lane Hands-on H3, engine: a turned kit part sorts with its own turn
// (src/pose.js), where the kit shader draws it. Splats sort in the pose they
// were built in, so Player.resortPose sorts a turned part again; sorted with
// the inverse turn, a turning shell drew its back over its front (the
// patterned egg's bottom, the storybook's cover).

import { test, expect } from "@playwright/test";
import { posePass } from "../src/pose.js";

// The kit shader's turn (spQuatRotate in src/effects.js): v + 2 q x (q x v + w v).
function shaderTurn(q, v) {
  const [x, y, z, w] = q;
  const c = [y * v[2] - z * v[1] + w * v[0], z * v[0] - x * v[2] + w * v[1], x * v[1] - y * v[0] + w * v[2]]; // prettier-ignore
  return [v[0] + 2 * (y * c[2] - z * c[1]), v[1] + 2 * (z * c[0] - x * c[2]), v[2] + 2 * (x * c[1] - y * c[0])]; // prettier-ignore
}

const axisAngle = (a, t) => {
  const l = Math.hypot(...a);
  const s = Math.sin(t / 2) / l;
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(t / 2)];
};

test("a turned part sorts where the shader draws it, its front nearer than its back, at 8 angles", () => {
  // A ring of splats round part 1's pivot (a shell seen from +z, the camera).
  const N = 16;
  const pivot = [0.2, -0.1, 0.05];
  const pos = new Float32Array(N * 3);
  const anim = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pos.set([pivot[0] + Math.cos(a) * 0.5, pivot[1] + Math.sin(a) * 0.3, pivot[2] + Math.sin(a) * 0.5], i * 3); // prettier-ignore
    anim.set([1, 0, 0, 0], i * 4);
  }
  const leaf = new Float32Array(32);
  for (const axis of [
    [0, 1, 0],
    [1, 0, 0],
    [0.3, 1, 0.5],
  ]) {
    // prettier-ignore
    for (let k = 0; k < 8; k++) {
      const q = axisAngle(axis, (k / 8) * Math.PI * 2);
      const parts = new Float32Array(16 * 12);
      for (let i = 0; i < 16; i++) parts[i * 12 + 3] = 1;
      parts.set(q, 12);
      parts.set([...pivot, 0], 16);
      const out = new Float32Array(N * 3);
      expect(posePass(pos, anim, N, out, leaf, parts)).toBe(N);
      const drawn = [];
      for (let i = 0; i < N; i++) {
        const p = [pos[i * 3] - pivot[0], pos[i * 3 + 1] - pivot[1], pos[i * 3 + 2] - pivot[2]];
        const d = shaderTurn(q, p).map((v, j) => v + pivot[j]);
        drawn.push(d);
        for (let j = 0; j < 3; j++) expect(out[i * 3 + j]).toBeCloseTo(d[j], 5);
      }
      // Front over back: the splat drawn nearest the camera sorts nearest.
      const nearDrawn = drawn.reduce((b, d, i) => (d[2] > drawn[b][2] ? i : b), 0);
      let nearSorted = 0;
      for (let i = 1; i < N; i++) if (out[i * 3 + 2] > out[nearSorted * 3 + 2]) nearSorted = i;
      expect(nearSorted).toBe(nearDrawn);
    }
  }
});

test("the patterned egg, turned by hand and sorted again, shows no hole at 8 angles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // Its bottom cap blue: only a hole (its back drawn over its front) shows it
  // from above.
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("patterned-egg");
    player.opts.idleDelay = 1e9;
    await app.setToyOptions({ c2: "#2040ff" });
  });
  await page.waitForTimeout(1000);
  const box = await page.evaluate(() => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    const a = player.screenPoint([-0.45, -0.5, 0.3]);
    const b = player.screenPoint([0.45, -0.85, 0.3]);
    return { x: r.left + Math.min(a[0], b[0]), y: r.top + Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }; // prettier-ignore
  });
  const blue = async () => {
    const png = await page.screenshot({ clip: box });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 150 && d[i] < 90 && d[i + 1] < 120) n++;
      return n / (img.width * img.height);
    }, png.toString("base64"));
  };
  for (let k = 0; k < 8; k++) {
    await page.evaluate((k) => {
      const p = window.__splashery.player;
      const a = (k / 8) * Math.PI * 2;
      p.motion.handsParts = {
        egg: { quat: [0, Math.sin(a / 2), 0, Math.cos(a / 2)], offset: [0, 0, 0] },
      };
      p.update(1 / 60);
      p.resortPose();
      p.stage.requestRender();
    }, k);
    // (Two frames: the sort lands on the next one.)
    await page.evaluate(
      () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))),
    );
    await page.waitForTimeout(400);
    expect(await blue(), `a turn of ${k * 45} degrees`).toBeLessThan(0.02);
  }
});
