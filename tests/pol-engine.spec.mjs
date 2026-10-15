// Lane Polish's engine additions (October 15, 2026):
// - a morph splat's channel may be 4 to 7: it moves on channel 0 to 3 as before and also shrinks
//   to 40% as it goes (Model to splats: the lifted cloud reads as separate flat discs). Channels 0
//   to 3, and every other kind's channel, are packed exactly as before.
// - the free science view (the microscope and the galaxy) fades what is nearer than the point the
//   camera looks at from 0.85 of that distance (gone at 0.55; it was 0.55 and 0.3).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

test("a morph's channel 4 to 7 is packed as given; other kinds still stop at 3", async ({
  page,
}) => {
  const errors = await open(page);
  const r = await page.evaluate(async () => {
    const { buildRecipe } = await import("/src/kit.js");
    const { KINDS } = await import("/src/effects.js");
    const recipe = {
      build(k) {
        const at = (x) => [x, 0, 0];
        for (const [i, ch] of [0, 2, 5, 7].entries())
          k.cloud({ count: 1, jitter: 0, pattern: false }, () => ({ p: at(i * 0.1), to: [i * 0.1, 0.3, 0], channel: ch, size: 1, color: "#ffffff", opacity: 1 })); // prettier-ignore
        k.cloud({ count: 1, jitter: 0, pattern: false }, () => ({ p: at(0.5), kind: "band", params: [0.2, 0.05], channel: 6, size: 1, color: "#ffffff", opacity: 1 })); // prettier-ignore
      },
    };
    const it = buildRecipe(recipe, { seed: 1, count: 5 });
    let s = it.next();
    while (!s.done) s = it.next();
    const buf = s.value.buf;
    const out = [];
    for (let i = 0; i < buf.count; i++) {
      const kind = buf.anim[i * 4 + 1];
      const w = buf.anim[i * 4 + 3];
      out.push(kind === KINDS.morph ? { morph: Math.floor(w / 4096) } : { band: Math.floor(w) });
    }
    return out;
  });
  expect(r.filter((x) => "morph" in x).map((x) => x.morph)).toEqual([0, 2, 5, 7]);
  expect(r.find((x) => "band" in x).band).toBe(3);
  expect(errors).toEqual([]);
});

test("the kit modifier shrinks a morph on channels 4 to 7 only, in GLSL and WGSL", async ({
  page,
}) => {
  const errors = await open(page);
  const src = await page.evaluate(async () => {
    const { MODIFIER_KIT } = await import("/src/effects.js");
    return { glsl: MODIFIER_KIT.glsl, wgsl: MODIFIER_KIT.wgsl };
  });
  expect(src.glsl).toContain("if (ch > 3.5) {");
  expect(src.glsl).toContain("spKitScale *= 1.0 - 0.6 * spChan(ch);");
  expect(src.wgsl).toContain("if (ch > 3.5) {");
  expect(src.wgsl).toContain("spKitScale = spKitScale * (1.0 - 0.6 * spChan(ch));");
  expect(errors).toEqual([]);
});

test("the free science view fades what is near the camera from 0.85 of the look distance", async ({
  page,
}) => {
  const errors = await open(page);
  const src = await page.evaluate(async () => {
    const { sciModifier } = await import("/src/science/field.js");
    const m = sciModifier(1, 1, { free: true });
    return { glsl: m.glsl, wgsl: m.wgsl };
  });
  expect(src.glsl).toContain("smoothstep(0.55, 0.85, length(center - uSpCam.xyz) / uSpCam.w)");
  expect(src.wgsl).toContain(
    "smoothstep(0.55, 0.85, length(center - uniform.uSpCam.xyz) / uniform.uSpCam.w)",
  );
  expect(errors).toEqual([]);
});
