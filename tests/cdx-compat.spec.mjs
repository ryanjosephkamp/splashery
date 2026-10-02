// Codex task 05: frozen historical links and JSON, through visitor entry paths.
// Like help.spec.mjs and g.spec.mjs, wait for data-ready and inspect the actual
// player. Fixtures carry commit provenance and frozen expected values; this file
// deliberately does not import today's encoder or normalizer to build its oracle.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const FIX = fileURLToPath(new URL("./fixtures/cdx-compat/", import.meta.url));
const cases = fs
  .readdirSync(FIX)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const fixture = JSON.parse(fs.readFileSync(`${FIX}${name}`, "utf8"));
    const { $comment, $compat, ...scene } = fixture;
    return { name, comment: $comment, ...$compat, scene };
  });
const QUERY = "?renderer=webgl2&profile=weak&labs=1";
const ENTRY_TIMEOUT = 15_000;
// Hundreds of visitor loads would retain redundant DOM/network snapshots.
// Keep failure screenshots and the runtime receipt, without tracing every load.
test.use({ trace: "off" });
// Use the laptop's actual WebGL2 GPU for the visitor corpus on macOS. The
// repository's SwiftShader launch flags are too slow for its two-minute budget.
// Other platforms keep the configured renderer launch options.
if (process.platform === "darwin") {
  test.use({
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-webgl"],
    },
  });
}

test("the frozen corpus has provenance, both formats, every pattern and every move", () => {
  expect(cases.length).toBeGreaterThanOrEqual(40);
  expect(cases.length).toBeLessThanOrEqual(80);
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
  expect(new Set(cases.map((c) => JSON.stringify(c.scene))).size).toBe(cases.length);
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
  const expected = structuredClone(c.expected);
  if (surface === "embed") expected.camera.distance *= 3.8 / 5;
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
  expect.soft(actual.id, `${surface}: built toy ${c.name}`).toBe(expected.toy.id);
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
