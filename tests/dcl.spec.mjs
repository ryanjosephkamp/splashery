// Lane Data and climate (docs/handoff/DataClimate.md): Data in 3D and Climate records.
// Node tests check the CSV reader on awkward files, the charts' picks and sampling, and the
// climate snapshots against the values read on the sources' live files on October 5, 2026
// (docs/evidence/climate-records.json). Browser tests open both toys, open a file through the
// Toy tab, and take the screenshots.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { readTable, parseDate, parseNumber, splitRows } from "../src/datavis/csv.js";
import { resolvePicks, sampleRows, maxPoints, binsOf, COUNT, NONE } from "../src/datavis/plot.js";
import { niceTicks, formatTick, dateTicks } from "../src/datavis/chart.js";
import { textPixels, faceLabels, MAX_LABELS } from "../src/datavis/text.js";
import { readCO2, readGistemp, spiralRadius, SPIRAL } from "../src/datavis/climate.js";
import { RECIPES, SAMPLES, SNAPSHOTS, openTable } from "../src/packs/data-climate.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const IDS = ["data-in-3d", "climate-records"];
const CO2 = "assets/toys/climate-records/co2-mlo-monthly.csv";
const GISTEMP = "assets/toys/climate-records/gistemp-v4-global.csv";

async function build(id, options = {}, count = 140000) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test.describe("the shelf", () => {
  test("two labs toys, each with a sound, a how-to, an About and credits", () => {
    for (const id of IDS) {
      const t = TOYS.find((x) => x.id === id);
      expect(t, id).toBeTruthy();
      expect(t.labs).toBe(true);
      expect(t.pack).toBe("data-climate");
      expect(TOY_SOUNDS[id], id).toBeTruthy();
      expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
      expect(TOY_HELP[id]?.about, id).toBeTruthy();
      expect(RECIPES[id].credits?.length, id).toBeGreaterThan(0);
    }
    expect(TOYS.find((x) => x.id === "data-in-3d").category).toBe("studio");
    expect(TOYS.find((x) => x.id === "climate-records").category).toBe("science");
  });
});

test.describe("the CSV reader", () => {
  test("quoted fields with commas, doubled quotes and line breaks; CRLF; a BOM", () => {
    const text = '﻿name,score,"note"\r\n"Smith, Jo",12,"said ""hi""\nthen left"\r\nLee,,ok\r\n';
    const rows = splitRows(text.slice(1), ",");
    expect(rows[1]).toEqual(["Smith, Jo", "12", 'said "hi"\nthen left']);
    const t = readTable(text, "x.csv");
    expect(t.header).toBe(true);
    expect(t.columns.map((c) => c.name)).toEqual(["name", "score", "note"]);
    expect(t.rows).toBe(2);
    const score = t.columns[1];
    expect(score.type).toBe("number");
    expect(score.values[0]).toBe(12);
    expect(Number.isNaN(score.values[1])).toBe(true);
    expect(score.missing).toBe(1);
  });

  test("tabs and semicolons, no header, comment lines and a title line on top", () => {
    const tsv = readTable("1\t2\t3\n4\t5\t6\n", "a.tsv");
    expect(tsv.delimiter).toBe("\t");
    expect(tsv.header).toBe(false);
    expect(tsv.columns.map((c) => c.name)).toEqual(["Column 1", "Column 2", "Column 3"]);
    const semi = readTable("a;b\n1,5;2\n3;4\n", "b.csv");
    expect(semi.delimiter).toBe(";");
    const noaa = readTable(fs.readFileSync(CO2, "utf8"), "co2.csv");
    expect(noaa.columns[0].name).toBe("year");
    const giss = readTable(fs.readFileSync(GISTEMP, "utf8"), "g.csv");
    expect(giss.title).toBe("Land-Ocean: Global Means");
    expect(giss.columns[0].name).toBe("Year");
    expect(giss.columns.find((c) => c.name === "Sep").missing).toBe(1); // 2026's "***"
  });

  test("numbers and dates as people write them", () => {
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("12%")).toBe(12);
    expect(parseNumber("−4")).toBe(-4);
    expect(parseNumber("$3.50")).toBe(3.5);
    expect(Number.isNaN(parseNumber("1,2"))).toBe(true);
    expect(parseDate("2026-10-05")).toBe(Date.UTC(2026, 9, 5));
    expect(parseDate("2026-10-05T06:14:15.888Z")).toBe(Date.UTC(2026, 9, 5, 6, 14, 15, 888));
    expect(parseDate("10/5/2026")).toBe(Date.UTC(2026, 9, 5));
    expect(parseDate("25/12/2026")).toBe(Date.UTC(2026, 11, 25));
    expect(parseDate("October 5, 2026")).toBe(Date.UTC(2026, 9, 5));
    expect(parseDate("Oct 2026")).toBe(Date.UTC(2026, 9, 1));
    const t = readTable("when,v\n2026-01-01,1\n2026-02-01,2\n,3\n", "d.csv");
    expect(t.columns[0].type).toBe("date");
    expect(t.columns[0].missing).toBe(1);
  });

  test("categories, text and plain messages for files that aren't tables", () => {
    const t = readTable(fs.readFileSync("assets/toys/data-in-3d/earthquakes-usgs.csv", "utf8"), "q.csv"); // prettier-ignore
    expect(t.columns.find((c) => c.name === "time").type).toBe("date");
    expect(t.columns.find((c) => c.name === "magType").type).toBe("category");
    expect(t.columns.find((c) => c.name === "place").type).toBe("text");
    expect(() => readTable("", "e.csv")).toThrow(/no rows/);
    const words = Array.from({ length: 20 }, (_, i) => `word${i},note${i}`).join("\n");
    expect(() => readTable(`a,b\n${words}\n`, "t.csv")).toThrow(/No column/);
    expect(() => readTable("PK\u0003\u0004\u0000\u0000junk", "x.xlsx")).toThrow(/binary/);
  });

  test("a few hundred thousand rows read in a few seconds and are sampled evenly", () => {
    const n = 300000;
    let text = "x,y,z,group\n";
    for (let i = 0; i < n; i++) text += `${i},${Math.sin(i)},${i % 97},"g${i % 5}"\n`;
    const t0 = Date.now();
    const t = readTable(text, "big.csv");
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(t.rows).toBe(n);
    const keep = sampleRows(n, maxPoints(140000));
    const kept = keep.reduce((s, v) => s + v, 0);
    expect(kept).toBe(maxPoints(140000));
    expect(sampleRows(n, maxPoints(140000))).toEqual(keep); // the same rows each time
    expect(sampleRows(100, 200)).toBe(null);
  });
});

test.describe("charts", () => {
  test("ticks are nice and short", () => {
    expect(niceTicks(0, 10, 5).ticks).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(327.3, 432.3, 5).ticks).toEqual([340, 360, 380, 400, 420]);
    expect(formatTick(1500000, 500000)).toBe("1.5M");
    expect(formatTick(0.25, 0.05)).toBe("0.25");
    const d = dateTicks(Date.UTC(2026, 8, 5), Date.UTC(2026, 9, 5), 5);
    expect(d.length).toBeGreaterThan(2);
    expect(d[0].text).toMatch(/^SEP \d+$/);
    expect(dateTicks(Date.UTC(1974, 4, 1), Date.UTC(2026, 7, 1), 5).map((t) => t.text)).toContain("2000"); // prettier-ignore
  });

  test("labels are pixels of the font and turn to face the camera", () => {
    expect(textPixels("1").ink.length).toBe(10);
    expect(textPixels("ppm").width).toBe(17);
    const tokens = faceLabels([{ token: 3, anchor: [1, 0, 0] }], Math.PI);
    expect(tokens[3].quat[1]).toBeCloseTo(1, 6);
    expect(faceLabels([{ token: 0, anchor: [0, 0, 0] }], null)).toEqual([]);
  });

  test("picks: the person's columns, the sample's, or the first usable ones", () => {
    const t = readTable("a,b,c,kind\n1,2,3,x\n4,5,6,y\n", "p.csv");
    expect(resolvePicks(t, {})).toEqual({ x: "a", y: "b", z: "c", color: "kind", size: NONE });
    expect(resolvePicks(t, { x: "c", z: NONE, color: "nope" }).x).toBe("c");
    expect(resolvePicks(t, { z: NONE }).z).toBe(NONE);
    expect(resolvePicks(t, { y: COUNT }, {}, "bars").y).toBe(COUNT);
    expect(resolvePicks(t, { y: COUNT }, {}, "scatter").y).not.toBe(COUNT);
  });

  test("whole numbers with few values (years, months) are bars of their own", () => {
    const t = readTable(fs.readFileSync(CO2, "utf8"), "co2.csv");
    const year = t.columns.find((c) => c.name === "year");
    const month = t.columns.find((c) => c.name === "month");
    expect(binsOf(year, 14)).toMatchObject({ n: 53, kind: "whole" });
    expect(binsOf(month, 14)).toMatchObject({ n: 12, kind: "whole" });
  });

  test("every sample builds as a scatter, bars and a surface within the label budget", async () => {
    for (const s of SAMPLES)
      for (const chart of ["scatter", "bars", "surface"]) {
        const ctx = await build("data-in-3d", { table: s.id, chart });
        const d = ctx.kit.data;
        expect(d.labels.length, `${s.id} ${chart}`).toBeLessThanOrEqual(MAX_LABELS);
        expect(d.report.shown, `${s.id} ${chart}`).toBeGreaterThan(0);
        expect(ctx.buf.count).toBeLessThanOrEqual(141000);
      }
    const quakes = await build("data-in-3d", {});
    expect(quakes.kit.data.report).toMatchObject({ chart: "scatter", rows: 520, shown: 520, sampled: false }); // prettier-ignore
  });

  test("your own file builds; a link to it without the file falls back to a sample", async () => {
    openTable("city,temp,rain\nOslo,6.1,763\nLima,19.2,6\nCairo,22.1,25\n", "cities.csv");
    const ctx = await build("data-in-3d", { table: "custom", chart: "bars" });
    expect(ctx.kit.data.report.rows).toBe(3);
    expect(ctx.kit.data.report.shown).toBe(3);
  });
});

test.describe("climate records: the snapshots against the sources", () => {
  // Values read on the live files on October 5, 2026 (NOAA's file of September 5, 2026;
  // GISTEMP v4 accessed October 5, 2026), listed in docs/evidence/climate-records.json.
  test("CO2: NOAA's own measurements from May 1974, with known months", () => {
    const rows = readCO2(fs.readFileSync(CO2, "utf8"));
    expect(rows[0]).toMatchObject({ year: 1974, month: 5, ppm: 333.19 });
    expect(rows.at(-1)).toMatchObject({ year: 2026, month: 8, ppm: 427.55 });
    const at = (y, m) => rows.find((r) => r.year === y && r.month === m).ppm;
    expect(at(2000, 1)).toBe(369.45);
    expect(at(2016, 5)).toBe(407.9);
    expect(Math.max(...rows.map((r) => r.ppm))).toBe(432.34); // May 2026
    expect(rows.length).toBe(628);
    // No Scripps month is shipped.
    expect(rows.some((r) => r.year < 1974 || (r.year === 1974 && r.month < 5))).toBe(false);
    const raw = fs.readFileSync(CO2, "utf8");
    expect(raw).not.toMatch(/^1958,/m);
    // Every month is there, in order, with no gap.
    for (let i = 1; i < rows.length; i++)
      expect((rows[i].year - rows[i - 1].year) * 12 + rows[i].month - rows[i - 1].month).toBe(1);
  });

  test("GISTEMP: anomalies from 1880, with known years", () => {
    const data = readGistemp(fs.readFileSync(GISTEMP, "utf8"));
    expect(data[0].year).toBe(1880);
    expect(data[0].months[0]).toBe(-0.19);
    expect(data[0].annual).toBe(-0.18);
    const y = (yr) => data.find((r) => r.year === yr);
    expect(y(1950).annual).toBe(-0.18);
    expect(y(2016).annual).toBe(1.01);
    expect(y(2024).annual).toBe(1.29);
    expect(y(2025).annual).toBe(1.19);
    expect(y(2026).months[7]).toBe(1.4);
    expect(Number.isNaN(y(2026).months[8])).toBe(true);
    expect(Number.isNaN(y(2026).annual)).toBe(true);
    expect(data.at(-1).year).toBe(2026);
  });

  test("the charts draw what the files hold", async () => {
    const co2 = await build("climate-records", { view: "co2" });
    const d = co2.kit.data;
    expect(d.first).toMatchObject({ year: 1974, month: 5, ppm: 333.19 });
    expect(d.last).toMatchObject({ year: 2026, month: 8, ppm: 427.55 });
    // The coil starts at May 1974's radius and ends at August 2026's.
    const p0 = d.curve(0);
    const p1 = d.curve(1);
    expect(Math.hypot(p0[0], p0[2])).toBeCloseTo(spiralRadius(333.19), 6);
    expect(Math.hypot(p1[0], p1[2])).toBeCloseTo(spiralRadius(427.55), 6);
    expect(p0[1]).toBe(0);
    expect(p1[1]).toBeCloseTo(SPIRAL.H, 6);
    expect(d.labels.length).toBeLessThan(MAX_LABELS); // the bead's token after them
    const months = await build("climate-records", { view: "months" });
    const data = readGistemp(fs.readFileSync(GISTEMP, "utf8"));
    const n = data.reduce((s, r) => s + r.months.filter((v) => !Number.isNaN(v)).length, 0);
    expect(months.kit.data.bars).toBe(n);
    const years = await build("climate-records", { view: "years" });
    expect(years.kit.data.bars).toBe(146); // 1880 to 2025
    expect(years.kit.data.years).toEqual([1880, 2025]);
  });

  test("the source and date show beside each chart", () => {
    expect(SNAPSHOTS.co2.caption).toMatch(/NOAA GML/);
    expect(SNAPSHOTS.gistemp.caption).toMatch(/GISTEMP/);
    for (const s of Object.values(SNAPSHOTS)) expect(s.caption).toMatch(/OCT 5, 2026/);
    const evidence = JSON.parse(fs.readFileSync("docs/evidence/climate-records.json", "utf8"));
    expect(evidence.toy).toBe("climate-records");
    expect(evidence.claims.length).toBeGreaterThan(2);
  });
});

test.describe("in the browser", () => {
  test("nothing of the lane loads before a toy opens; both toys open; a file opens", async ({
    page,
  }) => {
    // prettier-ignore
    const urls = [];
    page.on("request", (r) => urls.push(r.url()));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Desktop size: the Toy tab's panel shows beside the stage, not in the phone's sheet.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(urls.some((u) => /datavis|data-climate|climate-records\/|data-in-3d\//.test(u))).toBe(false); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.chooseToy("data-in-3d"));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "data-in-3d");
    await expect(page.locator("#dcl-panel")).toBeAttached();
    await expect(page.locator("#dcl-x")).toHaveValue("longitude");
    // Open a file through the Toy tab's file button.
    await page.setInputFiles("#toy-input-file", {
      name: "cities.csv",
      mimeType: "text/csv",
      buffer: Buffer.from('city,"temp, °C",rain\nOslo,6.1,763\nLima,19.2,6\nCairo,22.1,25\n'),
    });
    await expect(page.locator("#dcl-info")).toContainText("Your file has 3 rows", { timeout: 60_000 }); // prettier-ignore
    await expect(page.locator("#dcl-table")).toHaveValue("custom");
    await page.selectOption("#dcl-z", "rain");
    await expect(page.locator("#dcl-z")).toHaveValue("rain", { timeout: 60_000 });
    await page.click("#dcl-chart-bars");
    await expect(page.locator("#dcl-chart-bars")).toHaveAttribute("aria-pressed", "true", { timeout: 60_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.chooseToy("climate-records"));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "climate-records");
    const note = await page.evaluate(() => window.__splashery.player.toyInfo.recipe.note);
    expect(note).toMatch(/NOAA Global Monitoring Laboratory/);
    expect(note).toMatch(/October 5, 2026/);
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ page }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      // prettier-ignore
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      for (const [name, id, opts] of [
        ["data", "data-in-3d", null],
        ["climate", "climate-records", null],
        ["temperature", "climate-records", { view: "months" }],
      ]) {
        await page.evaluate(
          async ({ id, opts }) => {
            const { app, player } = window.__splashery;
            await app.chooseToy(id);
            if (opts) await app.setToyOptions(opts);
            player.camera.setTurntable(false);
          },
          { id, opts },
        );
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `tests/screenshots/dcl-${name}-${w}x${h}.png` });
      }
    }
  });
});
