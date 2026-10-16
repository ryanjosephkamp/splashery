import { test, expect } from "@playwright/test";

// Lane PT2 (the owner's review of October 16, 2026): One splat, many splats.
// A tap splits the splat under the finger into its two children, a second
// tap goes finer there, and a hold (or a tap at the finest level) merges a
// piece back. One soft sine per split or merge, pitched by the level.

// Two scenes saved before this change (frozen hashes; schema v3).
// Level 2 with two taps (nodes 4 and 8 split), the last split node 8.
const OLD_SPLITS =
  "d.fVPLctswDPyXzRXxyHKs2Lz13pt7aicHmIIdxjTJISk7bkb_3iH9qCeZVhcJFBZYLJYf4BCgkILl9CrxBMJBYjLeQc0IOgpn6b9lKLRN2z1Om8dp96NtVNup-WKynHU_QUgiPdR02T4vO0L2J6gP7IzrobAejM3GgWBK6J08lm4ZBB-y8S6VZCsHsVAtFSomJyg80QKXcOWHqAUKqzue9c_3G85yyqtyBLUYR4L1flcqr1nvttEPlUzgrYCQX2VfyvGQPQistbj8N678VpqtQE0J8h58GmIJRoJsNqJzJR38Tsq7iLVhm4SQchS3za9QzaQjHP16Xao0k_lIOFZF_pk_nxN6E0XnKn8zljAlbw9fuoQo3F8xKVT5zz366MOn7LUfnK4knkq25pwlXvP3vHWS_8PqmRC5N0M6FxgJ-WjSZwTv_VAkbCbz-6lnBH43ZZsnjIRkjf48S_DJXAYmpKNIqMD5DflekIGN-8LS_JZLx7N_L4H21kcoPEg3W7eC8R6fMu9Dgvr1MhI07yVyOT7x8SpnMFnXUu2CEL21lVlvUuYqY5GgGCVYrj7PQ3SZ68A5DnJ1CBScd3ImXxR3JbnegXpO2FjeQgGEEP3bde04Rg4gRAnCxWfTy0SFNB429QHdpiM8NOunzVLjpS7XXjW5rmRK6CWzsdWTZeX-3OkDbM3hRnvvyzdSNtbi3lWlv8vR22L6cRz_AA";
// A typed word, at the default level (links keep printable ASCII text).
const OLD_WORD =
  "d.fVLLctswDPyVdnNFPJIdOQlvvfXentrJAaJgmzVNckgqipvRv3dIP5pJptWFAglgsYt9BYcAhRQsp53EIwjPEpPxDmpF0FE4y_AlQ2HZLNe3bXPbrr8vG7Vaqrv1ousef4CQRAaoVffQtveE7I9Qr9gbN0ChH43NxoFgSuid3Ba0DIIP2XiXSvLkY3n9aj7lnUT5jHkmWO_35bFnvd9GP9Z-gbcCQt7JQaDAY_YgsNbi8t-4QnzTbAWqJchL8GmMJZgJstmIzhU3-L2Us_DdsE1CSDmK2-YdVLNYEybf96VLs-hmwlRJ_TO_6wiDiaJzVbCZS5iSt88fUEIUHi41KVQFTxhD9OFddu9Hp-sQdyVbc84SL_kH3jrJ_5nqnhB5MGM6NZgJeTLpfQUf_FgkbBbdW9YrAr-YBIUjZkKyRr_nEnwyZ8KENImEWthdK19KZWDjPkxpfssZ8WTBc6C99REKN7Je9UupbrjWp8yHkKB-Ps0EzQeJXK6PPF3kDCbr2mr5QIje2jrZYFLmKmORoBglWK5WzWN0mSvhHEe5OAQKzjs5DV8UdyW52rjeEzaWt1AAIUT_67J2TJEDCFGCcPFZe2ZUhsbNpn6gKzvCTdPfbR41nupy7UWTy0pawiCZja2eLCv3J6RXsDXP17EPvvwjZWMt3rqq4LscvS2mn-f5Dw";

test("a tap splits the touched splat, finer each time, and merges at the finest level", async () => {
  const { RECIPES, depth, levelSound, LEVEL_NOTES } = await import("../src/packs/one-splat.js");
  const { Kit } = await import("../src/kit.js");
  const r = RECIPES["one-splat"];
  let options = { word: "Hi", level: 1 };
  const build = () => {
    r.prepare(options);
    const k = new Kit(1, { count: 8000 });
    r.build(k, options);
    return k.data;
  };
  let data = build();
  // Recipe coordinates of node i, as build places it.
  const at = (i) =>
    r.action.at([data.tree.mx[i] - data.width / 2, data.tree.my[i] + data.height / 2, 0]);
  // Tap the node under each center: it splits, and the pitch is the new level.
  const first = data.ids[0];
  let res = at(first);
  expect(res.options.splits).toBe(String(first));
  expect(res.options.lastSplit).toBe(first);
  expect(res.pick).toBe(depth(first) + 1);
  options = { ...options, ...res.options };
  data = build();
  expect(data.ids).toContain(first * 2);
  expect(data.ids).toContain(first * 2 + 1);
  expect(data.ids).not.toContain(first);
  // The rest of the picture keeps its level.
  expect(data.ids).toContain(first ^ 1);
  // A second tap there goes one level finer.
  res = at(first * 2);
  expect(res.options.splits).toBe(`${first},${first * 2}`);
  options = { ...options, ...res.options };
  data = build();
  expect(data.ids).toContain(first * 4);
  // Splitting down to the finest level, then a tap there merges it back.
  let i = first * 4;
  while (i * 2 + 1 < data.tree.size) {
    res = at(i);
    options = { ...options, ...res.options };
    data = build();
    i *= 2;
  }
  res = at(i);
  expect(res.options.lastMerge).toBe(i >> 1);
  expect(res.options.splits.split(",").map(Number)).not.toContain(i >> 1);
  expect(res.pick).toBe(depth(i >> 1));
  // Finer is higher, and every pitch stays soft and below 1.4 kHz.
  expect(LEVEL_NOTES.length).toBe(15);
  expect(levelSound(3).f).toBe("D4");
  expect(levelSound(99).f).toBe("E6");
  expect(levelSound(5, true).vol).toBeLessThan(levelSound(5).vol);
});

async function open(page, size, hash = "") {
  await page.setViewportSize(size);
  await page.goto(
    "/?labs=1&renderer=webgl2&adapt=off&profile=" +
      (size.width === 390 ? "low" : "high") +
      (hash ? `#s=${hash}` : ""),
  );
  await page.waitForSelector("body[data-ready='true']");
  if (!hash) await page.evaluate(() => window.__splashery.app.chooseToy("one-splat"));
  await page.waitForFunction(
    () => window.__splashery.player.toyInfo?.id === "one-splat" && !window.__splashery.app.busy,
  );
  await page.evaluate(() => {
    window.__cues = [];
    window.__splashery.player.on("cue", (cues) => window.__cues.push(...cues));
  });
}

// Where node `id` sits on the screen.
async function screenOf(page, id) {
  return page.evaluate(async (id) => {
    const { player } = window.__splashery;
    const ctx = player.motion.ctx;
    const index = ctx.kit.data.ids.indexOf(id);
    const world = Array.from(ctx.buf.pos.slice(index * 3, index * 3 + 3));
    const pc = await import("/src/pc.js");
    const cam = player.stage.cameraEntity.camera;
    const vp = new pc.Mat4().mul2(cam.projectionMatrix, cam.viewMatrix);
    const q = vp.transformVec4(new pc.Vec4(...world, 1), new pc.Vec4());
    const box = document.querySelector("#stage").getBoundingClientRect();
    return {
      x: box.x + ((q.x / q.w + 1) * box.width) / 2,
      y: box.y + ((1 - q.y / q.w) * box.height) / 2,
    };
  }, id);
}

const ids = (page) => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.ids);
const settled = (page) =>
  expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.state.split ?? 0))
    .toBeLessThan(0.01);

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`taps split and a hold merges where the finger is, at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, size);
    expect(await ids(page)).toHaveLength(16);
    // Tap the splat nearest the middle (the level dial covers the right edge on a phone).
    const big = await page.evaluate(() => {
      const { ids, tree, width } = window.__splashery.player.motion.ctx.kit.data;
      const off = (i) => Math.abs(tree.mx[i] - width / 2);
      return ids.reduce((a, b) => (off(b) < off(a) ? b : a));
    });
    let at = await screenOf(page, big);
    await page.mouse.click(at.x, at.y);
    await expect.poll(() => ids(page)).toContain(big * 2);
    expect(await ids(page)).toHaveLength(17);
    expect(await ids(page)).not.toContain(big);
    await expect(page.locator("#one-splat-readout")).toContainText("Split into its two halves");
    await expect(page.locator("#one-splat-readout")).toContainText("Center:");
    await expect.poll(() => page.evaluate(() => window.__cues.map((c) => c.f))).toEqual(["G4"]);
    // The children start at their parent's center and move apart.
    expect(
      await page.evaluate(() => window.__splashery.player.motion.out?.morph?.[0] ?? 1),
    ).toBeGreaterThan(0.2);
    await settled(page);
    // A second tap there goes one level finer, and sounds higher.
    at = await screenOf(page, big * 2);
    await page.mouse.click(at.x, at.y);
    await expect.poll(() => ids(page)).toContain(big * 4);
    expect(await ids(page)).toHaveLength(18);
    await expect
      .poll(() => page.evaluate(() => window.__cues.map((c) => c.f)))
      .toEqual(["G4", "A4"]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `tests/screenshots/pt2-one-splat-${size.width}x${size.height}.png` }); // prettier-ignore
    await settled(page);
    // A hold on one of those pieces merges it back into its parent.
    at = await screenOf(page, big * 4);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect.poll(() => ids(page)).toContain(big * 2);
    await expect(page.locator("#one-splat-readout")).toContainText("Merged its two halves back");
    await page.mouse.up();
    expect(await ids(page)).toHaveLength(17);
    await expect
      .poll(() => page.evaluate(() => window.__cues.map((c) => c.f)))
      .toEqual(["G4", "A4", "G4"]);
    // The press was not also a tap.
    await page.waitForTimeout(300);
    expect(await ids(page)).toHaveLength(17);
    // The readout clears after a few seconds.
    await expect(page.locator("#one-splat-readout")).toHaveCount(0, { timeout: 9000 });
    // The level dial still works and clears the taps.
    await page.evaluate(() => window.__splashery.app.setToyOption("level", 6));
    await expect.poll(() => ids(page)).toHaveLength(64);
    expect(errors).toEqual([]);
  });
}

test("scenes saved before the new tap keep loading", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, { width: 390, height: 844 }, OLD_SPLITS);
  expect(await ids(page)).toEqual([16, 17, 9, 5, 6, 7]);
  expect(await page.evaluate(() => window.__splashery.player.scene.toy.options.lastSplit)).toBe(8);
  await page.goto("about:blank");
  await open(page, { width: 390, height: 844 }, OLD_WORD);
  expect(
    await page.evaluate(() => window.__splashery.player.toyInfo.recipe.input.shown()),
  ).toContain("Hi there!");
  expect((await ids(page)).length).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
