// Codex task 05: frozen historical links and JSON, through visitor entry paths.
// Like help.spec.mjs and g.spec.mjs, wait for data-ready and inspect the actual
// player. Fixtures carry commit provenance and frozen expected values; this file
// deliberately does not import today's encoder or normalizer to build its oracle.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { normalizeScene } from "../src/state.js";
import { TOYS, CATEGORIES } from "../src/toys.js";

const FIX = fileURLToPath(new URL("./fixtures/cdx-compat/", import.meta.url));
const corpus = fs
  .readdirSync(FIX)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const fixture = JSON.parse(fs.readFileSync(`${FIX}${name}`, "utf8"));
    const { $comment, $compat, ...scene } = fixture;
    return { name, comment: $comment, ...$compat, scene };
  });
const cases = corpus.filter((c) => c.route !== "world");
const worlds = corpus.filter((c) => c.route === "world");
const QUERY = "?renderer=webgl2&profile=weak&labs=1";
const ENTRY_TIMEOUT = 15_000;
// Hundreds of visitor loads would retain redundant DOM/network snapshots.
// Keep failure screenshots and the runtime receipt, without tracing every load.
test.use({ trace: "off" });
// Keep the browser's sandbox and graphics safety checks on every platform.
// No renderer override or GPU blocklist bypass is needed by the corpus.
test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    chromiumSandbox: true,
    args: [],
    ignoreDefaultArgs: ["--unsafely-disable-devtools-self-xss-warnings"],
  },
});

test("the frozen corpus has provenance, both formats, every pattern and every move", () => {
  expect(corpus.length).toBeGreaterThanOrEqual(60);
  expect(corpus).toHaveLength(95);
  expect(cases).toHaveLength(94);
  expect(worlds).toHaveLength(1);
  expect(
    new Set(cases.map((c) => TOYS.find((t) => t.id === c.scene.toy?.id)?.category).filter(Boolean)),
  ).toEqual(new Set(CATEGORIES.map((c) => c.id)));
  expect(new Set(cases.map((c) => c.scene.version))).toEqual(new Set([1, 2, 3]));
  expect(new Set(cases.map((c) => c.hash[0]))).toEqual(new Set(["d", "j"]));
  expect(new Set(cases.map((c) => c.expected.pattern?.id).filter(Boolean))).toEqual(
    new Set([
      "none",
      "flag",
      "stripes",
      "bands",
      "dots",
      "checks",
      "stars",
      "hearts",
      "zigzag",
      "gradient",
      "rainbow",
      "marble",
    ]),
  );
  expect(new Set(cases.map((c) => c.expected.motion?.move).filter(Boolean))).toEqual(
    new Set(["still", "bounce", "spin", "wobble", "float"]),
  );
  expect(new Set(cases.map((c) => c.expected.pattern?.projection).filter(Boolean))).toEqual(
    new Set(["wrap", "front", "globe", "top"]),
  );
  expect(cases.filter((c) => c.origin === "copied saved link")).toHaveLength(15);
  for (const c of cases) {
    expect(c.commit, c.name).toMatch(/^[a-f0-9]{40}$/);
    expect(c.comment, c.name).toContain(`${c.commit}:${c.file}`);
    // Independently decode the frozen bytes, catching stale/mismatched fixtures.
    const bytes = Buffer.from(c.hash.slice(2), "base64url");
    const decoded = JSON.parse(
      c.hash.startsWith("d.") ? inflateRawSync(bytes).toString() : bytes.toString(),
    );
    expect(decoded, c.name).toEqual(c.scene);
  }
  for (const c of corpus) {
    execFileSync("git", ["merge-base", "--is-ancestor", c.commit, "origin/main"]);
    execFileSync("git", ["cat-file", "-e", `${c.commit}:${c.file}`]);
  }
  for (const c of worlds) {
    const source = JSON.parse(execFileSync("git", ["show", `${c.commit}:${c.file}`]));
    expect(c.scene, c.name).toEqual(source);
    expect(c.scene.version).toBe(1); // World v1 is not a refused scene v1.
  }
  expect(new Set(cases.map((c) => JSON.stringify(c.scene))).size).toBe(cases.length);
});

test("frozen scene expectations still match schema v2/v3 normalization (unit only)", () => {
  for (const c of cases) {
    if (c.expected.refused) {
      expect(() => normalizeScene(c.scene, "weak"), c.name).toThrow(c.expected.refused);
    } else {
      const actual = normalizeScene(c.scene, "weak");
      delete actual.createdAt;
      expect(actual, c.name).toEqual(c.expected);
    }
  }
});

async function ready(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery?.player;
      return document.body.dataset.ready === "true" && !!p?.toyInfo && !!p.stage?.toy;
    },
    null,
    { timeout: ENTRY_TIMEOUT },
  );
  // data-ready also accompanies a fallback poster, so require the GPU toy.
  await expect(page.locator("#stage")).toBeVisible();
}

async function loaded(page, c, surface) {
  const expected = expectedOn(c, surface);
  const actual = await page.evaluate(() => {
    const p = window.__splashery.player;
    const scene = structuredClone(p.scene);
    delete scene.createdAt;
    return {
      scene,
      id: p.toyInfo.id,
      options: p.toyInfo.options,
      optionKeys: p.toyInfo.recipe?.options?.map((o) => o.key) || [],
      controls: p.motion.targets,
    };
  });
  expect.soft(actual.scene, `${surface}: ${c.name}`).toEqual(expected);
  expect.soft(actual.id, `${surface}: built toy ${c.name}`).toBe(c.builtId || expected.toy.id);
  if (c.builtOptions)
    expect
      .soft(actual.options, `${surface}: resolved recipe ${c.name}`)
      .toMatchObject(c.builtOptions);
  // Check every saved option recognized by the actual recipe, as well as the
  // document. A loader that keeps text but builds defaults must fail here.
  const recognized = Object.fromEntries(
    Object.entries(expected.toy.options || {}).filter(([key]) => actual.optionKeys.includes(key)),
  );
  if (Object.keys(recognized).length)
    expect.soft(actual.options, `${surface}: built options ${c.name}`).toMatchObject(recognized);
  if (expected.pattern.id !== "none") {
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.patternOn), {
        timeout: ENTRY_TIMEOUT,
        message: `${surface}: pattern applied ${c.name}`,
      })
      .toBe(true);
  }
  // A scene can retain a saved control while a broken loader resets the driver.
  if (c.name === "chest-open.json")
    expect.soft(actual.controls.open, `${surface}: chest driver`).toBe(1);
  if (c.renderView) {
    // A retained option does not prove the real relief/splat renderer used it.
    await expect
      .configure({ soft: true })
      .poll(
        async () => {
          const { sharpState } = await page.evaluate(async () => {
            const m = await import("/src/packs/photo-sharp.js");
            return { sharpState: m.sharpState() };
          });
          return sharpState.views[c.expected.toy.id];
        },
        { timeout: ENTRY_TIMEOUT, message: `${surface}: actual photo view ${c.name}` },
      )
      .toBe(c.renderView);
  }
}

function expectedOn(c, surface) {
  const expected = structuredClone(c.expected);
  if (surface === "embed") {
    expected.camera.distance *= 3.8 / 5;
    if (c.embedDropsMedia) delete expected.toy.media;
  }
  return expected;
}

test("all historical cases load at /, /embed/, and through Load JSON without page errors", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const started = performance.now();
  const contexts = await Promise.all(
    ["app", "embed", "file"].map(() =>
      browser.newContext({
        viewport: { width: 400, height: 300 },
        reducedMotion: "reduce",
      }),
    ),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const errors = pages.map((page) => {
    const found = [];
    page.on("pageerror", (e) => found.push(e.message));
    return found;
  });
  try {
    await pages[2].goto(`/${QUERY}`, { waitUntil: "domcontentloaded" });
    await ready(pages[2]);
    for (const c of cases) {
      await test.step(c.name, async () => {
        await Promise.all(
          pages.map(async (page, i) => {
            const surface = ["app", "embed", "file"][i];
            const beforeRefusal =
              c.expected.refused && surface === "file"
                ? await page.evaluate(() => structuredClone(window.__splashery.player.scene))
                : null;
            if (surface === "file") {
              // Keep the actual input path used by help.spec.mjs/smoke.spec.mjs;
              // provenance keys in the JSON are unknown keys, safely discarded.
              await page.setInputFiles("#import-json", `${FIX}${c.name}`);
              if (!c.expected.refused) {
                await expect(page.locator("#toast")).toHaveText(`Loaded ${c.name}.`, {
                  timeout: ENTRY_TIMEOUT,
                });
              }
            } else {
              // A hash-only navigation does not run startup again. A distinct
              // query makes each fixture a real visitor load of the entry page.
              await page.goto(
                `${surface === "embed" ? "/embed/" : "/"}${QUERY}&compat=${c.name}#s=${c.hash}`,
                {
                  waitUntil: "domcontentloaded",
                },
              );
              await ready(page);
            }
            if (c.expected.refused) {
              const message = surface === "embed" ? "#embed-status" : "#toast";
              await expect(page.locator(message)).toContainText(c.expected.refused, {
                timeout: ENTRY_TIMEOUT,
              });
              expect
                .soft(await page.evaluate(() => window.__splashery.player.scene.version))
                .toBe(3);
              if (beforeRefusal)
                expect
                  .soft(await page.evaluate(() => window.__splashery.player.scene))
                  .toEqual(beforeRefusal);
            } else {
              await loaded(page, c, surface);
            }
            expect.soft(errors[i], `${surface}: page errors in ${c.name}`).toEqual([]);
          }),
        );
      });
    }
    const elapsedMs = Math.round(performance.now() - started);
    await testInfo.attach("compat-runtime", {
      body: JSON.stringify({ cases: cases.length, visitorLoads: cases.length * 3, elapsedMs }),
      contentType: "application/json",
    });
    expect(elapsedMs, "visitor corpus runtime stays below two minutes").toBeLessThan(120_000);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

async function downloadScene(page, testInfo, label) {
  if (!(await page.locator("#panel-body").isVisible()))
    await page.locator("#sheet-toggle").click({ timeout: ENTRY_TIMEOUT });
  await page.locator("#tab-share").click({ timeout: ENTRY_TIMEOUT });
  const pending = page.waitForEvent("download", { timeout: ENTRY_TIMEOUT });
  await page.locator("#export-json").click({ timeout: ENTRY_TIMEOUT });
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^splashery-.*\.json$/);
  const bytes = fs.readFileSync(await download.path());
  await testInfo.attach(label, { body: bytes, contentType: "application/json" });
  const scene = JSON.parse(bytes);
  delete scene.createdAt;
  return { bytes, scene };
}

function savedScene(actual, expected, label) {
  const { camera, ...settings } = actual;
  const { camera: wanted, ...wantedSettings } = expected;
  expect.soft(settings, `${label}: downloaded settings`).toEqual(wantedSettings);
  expect
    .soft(Object.keys(camera).sort(), `${label}: camera keys`)
    .toEqual(Object.keys(wanted).sort());
  for (const key of ["yaw", "pitch", "roll", "distance"])
    expect.soft(camera[key], `${label}: downloaded camera ${key}`).toBeCloseTo(wanted[key], 3);
  if (wanted.pan) {
    expect.soft(camera.pan?.length, `${label}: pan length`).toBe(3);
    for (let i = 0; i < 3; i++)
      expect.soft(camera.pan?.[i], `${label}: downloaded pan ${i}`).toBeCloseTo(wanted.pan[i], 3);
  }
}

// Independent cases retain diagnostics after a slow corpus hits the unchanged
// 120-second whole-file target above. Every fixture still runs every entry route.
// Download comparisons use the historical oracle, never the just-saved document.
for (const c of cases) {
  test(`persisted visitor scene: ${c.name}`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const contexts = await Promise.all(
      ["app", "embed", "file"].map(() =>
        browser.newContext({ viewport: { width: 400, height: 300 }, reducedMotion: "reduce" }),
      ),
    );
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const errors = pages.map((page) => {
      const messages = [];
      page.on("pageerror", (error) => messages.push(error.message));
      return messages;
    });
    try {
      await Promise.all(
        pages.map(async (page, i) => {
          const surface = ["app", "embed", "file"][i];
          await page.goto(
            `${surface === "embed" ? "/embed/" : "/"}${QUERY}&persist=${c.name}${surface === "file" ? "" : `#s=${c.hash}`}`,
            { waitUntil: "domcontentloaded" },
          );
          await ready(page);
          const before =
            c.expected.refused && surface === "file"
              ? await page.evaluate(() => structuredClone(window.__splashery.player.scene))
              : null;
          if (surface === "file") {
            await page.setInputFiles("#import-json", `${FIX}${c.name}`);
            if (!c.expected.refused)
              await expect(page.locator("#toast")).toHaveText(`Loaded ${c.name}.`, {
                timeout: ENTRY_TIMEOUT,
              });
          }
          if (c.expected.refused) {
            await expect(
              page.locator(surface === "embed" ? "#embed-status" : "#toast"),
            ).toContainText(c.expected.refused);
            if (before)
              expect(await page.evaluate(() => window.__splashery.player.scene)).toEqual(before);
          } else await loaded(page, c, surface);
        }),
      );
      if (!c.expected.refused) {
        // Let at least one real driver frame run before saving. In-memory camera
        // normalization missed the Video to 3D driver's subsequent override.
        await pages[0].waitForFunction(() => window.__splashery.player.time > 0, null, {
          timeout: ENTRY_TIMEOUT,
        });
        const first = await downloadScene(pages[0], testInfo, "downloaded-scene");
        savedScene(first.scene, c.expected, c.name);
        // Reload the actual downloaded bytes in a fresh context. This prevents
        // Studio's own-file caches from masquerading as persisted scene data.
        await contexts[2].close();
        contexts[2] = await browser.newContext({
          viewport: { width: 400, height: 300 },
          reducedMotion: "reduce",
        });
        pages[2] = await contexts[2].newPage();
        pages[2].on("pageerror", (error) => errors[2].push(error.message));
        await pages[2].goto(`/${QUERY}&reload=${c.name}`);
        await ready(pages[2]);
        const name = `saved-${c.name}`;
        await pages[2].setInputFiles("#import-json", {
          name,
          mimeType: "application/json",
          buffer: first.bytes,
        });
        await expect(pages[2].locator("#toast")).toHaveText(`Loaded ${name}.`, {
          timeout: ENTRY_TIMEOUT,
        });
        await loaded(pages[2], c, "reloaded download");
        const second = await downloadScene(pages[2], testInfo, "reloaded-scene-download");
        savedScene(second.scene, c.expected, `reloaded ${c.name}`);
      }
      for (let i = 0; i < errors.length; i++)
        expect.soft(errors[i], `${c.name}: page ${i} errors`).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

for (const c of worlds) {
  test(`historical world-file route: ${c.name}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Worlds has no Save JSON or #s= scene route. Serve the historical bytes
    // only at its real world-file URL; all renderer and asset requests are real.
    await page.route(`**/worlds/${c.worldId}/world.json`, (route) => {
      requests.push(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(c.scene) });
    });
    await page.goto(`/worlds/?labs=1&world=${c.worldId}&renderer=webgl2&profile=low&clock=manual`);
    await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60_000 });
    expect(await page.evaluate(() => document.body.dataset.ready)).toBe("true");
    expect(requests).toEqual([`/worlds/${c.worldId}/world.json`]);
    expect(await page.evaluate(() => window.__world.page.def)).toEqual(c.expected);
    expect(await page.title()).toBe(`${c.expected.title} · Splashery Worlds`);
    await expect(page.locator("#start-title")).toHaveText(c.expected.title);
    await page.locator("#enter").click();
    await expect(page.locator("#hud")).toBeVisible();
    const built = await page.evaluate(() => {
      const w = window.__world;
      return {
        character: w.char(),
        props: w.world.props.map((p) => ({ id: p.prop.id, at: [p.x, p.z] })),
      };
    });
    expect(built.character.pos[0]).toBeCloseTo(c.expected.spawn.at[0], 3);
    expect(built.character.pos[2]).toBeCloseTo(c.expected.spawn.at[1], 3);
    for (const p of c.expected.props.filter((p) => p.only !== "hybrid"))
      expect(built.props).toContainEqual({ id: p.id, at: p.at });
    await testInfo.attach("world-route-receipt", {
      body: JSON.stringify({ requests, built }),
      contentType: "application/json",
    });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60_000 });
    expect(await page.evaluate(() => window.__world.page.def)).toEqual(c.expected);
    expect(errors).toEqual([]);
  });
}
