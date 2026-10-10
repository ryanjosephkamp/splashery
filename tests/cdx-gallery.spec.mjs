import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const entries = JSON.parse(
  fs.readFileSync(new URL("../src/equation-gallery.json", import.meta.url), "utf8"),
);
const keys = ["id", "title", "group", "about", "program", "source", "loops"];

test("the gallery is complete, readable, and compiles in the page", async ({ page }) => {
  expect(entries).toHaveLength(60);
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  for (const entry of entries) {
    expect(Object.keys(entry).sort()).toEqual([...keys].sort());
    expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(entry.title.trim()).not.toBe("");
    expect(entry.about.trim()).not.toBe("");
    expect(typeof entry.loops).toBe("boolean");
    expect(entry.source === "" || /^https:\/\//.test(entry.source)).toBe(true);
  }
  const groupCounts = Object.groupBy(entries, (entry) => entry.group);
  expect(Object.keys(groupCounts).sort()).toEqual([
    "Classic surfaces",
    "Color play",
    "Curves as tubes or beads",
    "Math showpieces",
    "Nature-like shapes",
    "Things in motion",
  ]);
  for (const group of Object.values(groupCounts)) expect(group).toHaveLength(10);

  await page.goto("/manual/index.html");
  const outcomes = await page.evaluate(async (gallery) => {
    const { compileProgram } = await import("/src/packs/splat-equation.js");
    return gallery.map((entry) => {
      const fields = Object.fromEntries(
        entry.program.split("\n").map((line) => {
          const equals = line.indexOf(" = ");
          return [line.slice(0, equals), line.slice(equals + 3)];
        }),
      );
      for (const [name, value] of Object.entries(fields)) {
        const length = value.length;
        if (length > 120) throw new Error(`${entry.id}.${name} is ${length} characters`);
      }
      const program = compileProgram(fields);
      const [u0, u1] = program.u;
      const [v0, v1] = program.v;
      let skipped = 0;
      const total = 24 * 24 * 12;
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 24; j++) {
          const u = u0 + ((i + 0.5) * (u1 - u0)) / 24;
          const v = v0 + ((j + 0.5) * (v1 - v0)) / 24;
          for (let k = 0; k < 12; k++) {
            const at = { θ: u, y: v, t: (k * Math.PI * 2) / 11 };
            if (![program.x.f(at), program.y.f(at), program.z.f(at)].every(Number.isFinite))
              skipped++;
          }
        }
      }
      let loopError = 0;
      if (entry.loops) {
        for (let i = 0; i < 16; i++) {
          for (let j = 0; j < 16; j++) {
            const u = u0 + ((i + 0.5) * (u1 - u0)) / 16;
            const v = v0 + ((j + 0.5) * (v1 - v0)) / 16;
            const start = [program.x, program.y, program.z].map((field) =>
              field.f({ θ: u, y: v, t: 0 }),
            );
            const end = [program.x, program.y, program.z].map((field) =>
              field.f({ θ: u, y: v, t: Math.PI * 2 }),
            );
            loopError = Math.max(loopError, ...start.map((value, n) => Math.abs(value - end[n])));
          }
        }
      }
      return { id: entry.id, skipped, total, loopError };
    });
  }, entries);
  for (const result of outcomes) {
    expect(result.skipped / result.total, result.id).toBeLessThan(0.02);
    expect(result.loopError, result.id).toBeLessThan(1e-8);
  }

  const report = fs.readFileSync(
    new URL("../docs/audits/program-gallery-2026-10.md", import.meta.url),
    "utf8",
  );
  const normalizedReport = report.replace(/\s+/g, " ");
  for (const { title, about } of entries) {
    expect(normalizedReport).toContain(title);
    expect(normalizedReport).toContain(about);
  }
  expect(() =>
    execFileSync("node", ["tools/us-english.mjs", "docs/audits/program-gallery-2026-10.md"]),
  ).not.toThrow();
});
