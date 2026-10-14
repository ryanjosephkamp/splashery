import { test, expect } from "@playwright/test";
import { GifReader } from "../vendor/omggif/omggif.js";
import { TOYS, findToy } from "../src/toys.js";
import list from "../src/ascii-capture/toys.json" with { type: "json" };
import {
  ORIGINAL,
  LISTED,
  PRESETS,
  SHELVES,
  newJobId,
  readLabMessage,
  startMessage,
} from "../src/ascii-capture/protocol.js";
import { scoreGif, verdict, LIMITS } from "../tools/asc2-check.mjs";

// Lane ASCII r2: the toy list, the legibility check and the grouped picker.
// The picker and list tests need no capture; one passing toy is captured.

const LAB = "/ascii-lab.html?deadline=180&profile=high";
const SHELF_IDS = list.shelves.map((s) => s.id);

test("the list holds only kit toys on its six shelves, and every one is a valid preset", () => {
  expect(SHELF_IDS).toEqual(["food", "balls", "shapes", "gems", "toys", "music"]);
  const seen = new Set();
  for (const t of list.toys) {
    const toy = findToy(t.id);
    expect(toy, t.id).toBeTruthy();
    expect(seen.has(t.id), `duplicate ${t.id}`).toBe(false);
    seen.add(t.id);
    expect(toy.category, t.id).toBe(t.shelf);
    expect(SHELF_IDS).toContain(t.shelf);
    // No photoreal scan, no live input, no data or map toy.
    expect(toy.kind === "captured", `${t.id} is a scan`).toBe(false);
    expect(toy.labs, `${t.id} is a labs toy`).toBeFalsy();
    expect(["scans", "geo", "studio", "pictures", "imaging", "science"]).not.toContain(
      toy.category,
    );
    expect([48, 72, 96, 144]).toContain(t.columns);
    const job = newJobId();
    expect(readLabMessage(startMessage(job, t.id), job)).toBe("start");
  }
  expect(list.toys.length).toBeGreaterThanOrEqual(60);
  expect(SHELVES.length).toBe(6);
});

test("the first three presets are exactly as they were, and listed toys never replace them", () => {
  expect(Object.keys(ORIGINAL)).toEqual(["grapes", "orange", "strawberry"]);
  expect(ORIGINAL.orange.options).toEqual({ style: "whole" });
  for (const id of Object.keys(ORIGINAL)) {
    expect(LISTED[id]).toBeUndefined();
    expect(PRESETS[id]).toBe(ORIGINAL[id]);
  }
  expect(Object.keys(PRESETS).length).toBe(3 + list.toys.length);
});

test("every candidate has a verdict, and a failure names its reasons", () => {
  for (const t of list.toys) {
    expect(t.check, t.id).toBeTruthy();
    if (t.check.pass) {
      for (const key of ["fill", "span", "edge", "motion"]) expect(t.check[key]).toBeGreaterThan(0);
      expect(t.check.fill).toBeGreaterThanOrEqual(LIMITS.fillMin);
      expect(t.check.edge).toBeGreaterThanOrEqual(LIMITS.edgeMin);
      expect(t.check.motion).toBeGreaterThanOrEqual(LIMITS.motionMin);
    } else {
      expect(t.check.why.length).toBeGreaterThan(10);
    }
  }
  expect(verdict({ fill: 0.3, span: 0.7, edge: 0.04, motion: 0.01 })).toEqual([]);
  expect(verdict({ fill: 0.02, span: 0.2, edge: 0.001, motion: 0 }).length).toBe(4);
});

test("the picker lists the first three, then each shelf's passing toys, and nothing else", async ({
  page,
  baseURL,
}) => {
  await page.goto(new URL(LAB, baseURL).href);
  await page.waitForSelector("body[data-ready='true']");
  const groups = await page.$$eval("#preset optgroup", (gs) =>
    gs.map((g) => ({ label: g.label, ids: [...g.querySelectorAll("option")].map((o) => o.value) })),
  );
  expect(groups[0]).toEqual({ label: "First three", ids: ["grapes", "orange", "strawberry"] });
  const passing = (shelf) => list.toys.filter((t) => t.shelf === shelf && t.check?.pass).map((t) => t.id); // prettier-ignore
  const expected = list.shelves.filter((s) => passing(s.id).length);
  expect(groups.slice(1).map((g) => g.label)).toEqual(expected.map((s) => s.label));
  for (const [i, shelf] of expected.entries()) expect(groups[i + 1].ids).toEqual(passing(shelf.id));
  // The lab itself never makes a WebGL context or starts a job.
  expect(await page.textContent("#status")).toBe("Ready.");
  await page.goto(new URL(`${LAB}&all=1`, baseURL).href);
  await page.waitForSelector("body[data-ready='true']");
  expect(await page.locator("#preset option").count()).toBe(3 + list.toys.length);
});

test("a listed toy captures with its own credit, and the check scores the GIF it makes", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const pick = list.toys.find((t) => t.check?.pass);
  expect(pick).toBeTruthy();
  await page.goto(new URL(LAB, baseURL).href);
  await page.waitForSelector("body[data-ready='true']");
  await page.selectOption("#preset", pick.id);
  await page.selectOption("#columns", "48");
  await page.click("#capture");
  await page.waitForFunction(() => ["done", "failed"].includes(document.body.dataset.state), null, {
    timeout: 220_000,
  });
  expect(await page.getAttribute("body", "data-state")).toBe("done");
  expect(await page.textContent("#credit")).toContain(`${pick.label}: Splashery, MIT`);
  const pending = page.waitForEvent("download");
  await page.click("#download");
  const file = await pending;
  const bytes = new Uint8Array(
    await (await import("node:fs/promises")).readFile(await file.path()),
  );
  const reader = new GifReader(bytes);
  expect(reader.numFrames()).toBe(40);
  const s = scoreGif(bytes);
  expect(s.columns).toBe(48);
  expect(s.fill).toBeGreaterThan(0);
  expect(TOYS.some((t) => t.id === pick.id)).toBe(true);
});
