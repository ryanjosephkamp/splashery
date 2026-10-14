// Lane Photoreal r2: the second round of photoreal captures (docs/handoff/PhotorealR2.md).
// Every toy has its file pair, a credit with author, license and link, a how-to and About text and
// a sound; every NonCommercial asset is tagged so tools/nc-assets.mjs can list it; no ND license.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { TOYS } from "../src/toys.js";
import { PHOTOREAL_R2_TOYS } from "../src/packs/photoreal-r2.js";
import { TOY_HELP } from "../src/toy-help.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";

const manifest = JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).toys.filter((t) => t.pack === "pr2"); // prettier-ignore
const MB = 1024 * 1024;

test.describe("Photoreal r2", () => {
  test("30 to 50 toys, behind the labs switch, on the Photoreal shelf", () => {
    expect(PHOTOREAL_R2_TOYS.length).toBeGreaterThanOrEqual(30);
    expect(PHOTOREAL_R2_TOYS.length).toBeLessThanOrEqual(50);
    expect(manifest.map((m) => m.id)).toEqual(PHOTOREAL_R2_TOYS.map((t) => t.id));
    for (const t of PHOTOREAL_R2_TOYS) {
      const def = TOYS.find((x) => x.id === t.id);
      expect(def, t.id).toBeTruthy();
      expect(def.labs, t.id).toBe(true);
      expect(def.category).toBe("scans");
      expect(def.kind).toBe("captured");
    }
  });

  test("each has a file pair sized for phones, a credit, help and a sound", () => {
    for (const t of PHOTOREAL_R2_TOYS) {
      for (const url of [t.url, t.urlWeak]) {
        expect(fs.existsSync(url), url).toBe(true);
        expect(fs.statSync(url).size, url).toBeLessThan(25 * MB);
      }
      expect(fs.statSync(t.urlWeak).size, t.id).toBeLessThanOrEqual(fs.statSync(t.url).size);
      expect(fs.existsSync(`assets/toys/${t.id}/thumb.webp`), `${t.id} thumbnail`).toBe(true);
      const c = t.credit;
      for (const k of ["title", "author", "source", "license", "licenseUrl", "changes"])
        expect(c[k], `${t.id} credit.${k}`).toBeTruthy();
      expect(c.source).toMatch(/^https:\/\/superspl\.at\/scene\/[0-9a-f]{8}$/);
      expect(TOY_HELP[t.id]?.howTo, t.id).toMatch(/^[A-Z]/);
      expect(TOY_HELP[t.id]?.about, t.id).toMatch(/\S/);
      expect(TOY_SOUNDS[t.id], t.id).toBeTruthy();
    }
  });

  test("the credits file names every toy and its license", () => {
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    for (const t of PHOTOREAL_R2_TOYS) {
      expect(credits, t.id).toContain(t.credit.source);
      expect(credits, t.id).toContain(t.credit.author);
    }
  });

  test("NonCommercial assets are tagged and listed; no NoDerivatives license", () => {
    const out = execFileSync("node", ["tools/nc-assets.mjs", "--check"], { encoding: "utf8" });
    expect(out).toMatch(/^OK/);
    const nc = manifest.filter((m) => /(^|[\s-])NC(?=$|[\s-])/.test(m.license));
    expect(nc.length).toBeGreaterThan(0);
    for (const m of nc) {
      expect(m.nc, m.id).toBe(true);
      const t = PHOTOREAL_R2_TOYS.find((x) => x.id === m.id);
      expect(t.credit.license, m.id).toBe(m.license);
    }
    const listed = JSON.parse(execFileSync("node", ["tools/nc-assets.mjs", "--json"], { encoding: "utf8" })); // prettier-ignore
    for (const m of nc) expect(listed.map((l) => l.id)).toContain(m.id);
    for (const m of manifest) expect(m.license, m.id).not.toMatch(/ND/);
  });
});
