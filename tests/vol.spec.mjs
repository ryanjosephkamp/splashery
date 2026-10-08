// Lane Volume viewer: the readers (src/volume/read.js), the view (src/volume/view.js) and the toy
// (src/packs/volume-viewer.js). The test volumes are made by tools/vol-fixtures.mjs
// (tests/fixtures/vol/): one phantom of 24 × 20 × 12 voxels, 0.5 × 0.5 × 2 mm, in every format.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { readVolume, VolumeError, unzip } from "../src/volume/read.js";
import { windowFor, presetWindow, volumeStats } from "../src/volume/view.js";
import { RECIPES, SAMPLES, VOLUME_STATE, describe } from "../src/packs/volume-viewer.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { TOYS } from "../src/toys.js";
import { TOY_HELP } from "../src/toy-help.js";
import { toySound } from "../src/toy-sounds.js";
import { PROFILES } from "../src/generators.js";

const FIX = "tests/fixtures/vol";
const APP = "/?renderer=webgl2&adapt=off&labs=1";
const truth = JSON.parse(fs.readFileSync(path.join(FIX, "phantom.json"), "utf8"));
const file = (f) => ({ name: f, bytes: new Uint8Array(fs.readFileSync(path.join(FIX, f))) });
const dir = (d) => fs.readdirSync(path.join(FIX, d)).map((f) => file(`${d}/${f}`));
const R = RECIPES["volume-viewer"];
const defaults = Object.fromEntries(R.options.map((x) => [x.key, x.default]));

// The value at a voxel.
const at = (v, x, y, z) => v.data[(z * v.ny + y) * v.nx + x];

async function build(options = {}, count = 60000) {
  const o = { ...defaults, ...options };
  await R.prepare(o);
  const it = buildRecipe(R, { seed: 3, count, options: o }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

const FORMATS = {
  "DICOM series (shuffled names)": () => dir("dicom-series"),
  "DICOM series in a zip": () => [file("dicom-series.zip")],
  "DICOM multi-frame": () => [file("dicom-multiframe.dcm")],
  "DICOM RLE Lossless": () => [file("dicom-rle.dcm")],
  "NIfTI-1": () => [file("phantom.nii")],
  "NIfTI-1, gzipped": () => [file("phantom.nii.gz")],
  "NIfTI-2, big endian": () => [file("phantom-nifti2.nii")],
  "TIFF multi-page": () => [file("phantom.tif")],
};

test.describe("reading volumes", () => {
  for (const [name, files] of Object.entries(FORMATS))
    test(`${name}: the phantom with its size, spacing and values`, async () => {
      const v = await readVolume(files());
      expect([v.nx, v.ny, v.nz]).toEqual(truth.size);
      // Spacing honored: 0.5 mm in the slice, 2 mm between slices.
      expect(v.spacing).toEqual(truth.spacing);
      const [bx, by, bz] = truth.bone;
      const air = at(v, 0, 0, 0);
      const soft = at(v, 12, 10, 6);
      const bone = at(v, bx, by, bz);
      if (/TIFF/.test(name)) {
        // Stored values (HU + 1024), no rescale in a TIFF.
        expect([air, soft, bone]).toEqual([24, 1064, 2024]);
      } else {
        expect([air, soft, bone]).toEqual([truth.air, truth.soft, truth.boneHU]);
      }
    });

  test("the DICOM series is sorted by the slices' places and turned head up", async () => {
    const v = await readVolume(FORMATS["DICOM series (shuffled names)"]());
    expect(v.unit).toBe("HU");
    expect(v.format).toMatch(/DICOM series \(12 files\)/);
    // Columns run to the patient's left (the toy's right), rows to the back (away from the
    // viewer), slices upward (the scan's feet-to-head direction).
    expect(v.view).toEqual([
      { axis: 0, sign: 1 },
      { axis: 2, sign: -1 },
      { axis: 1, sign: 1 },
    ]);
    // The bone sits near the last slice: the top.
    expect(at(v, 6, 5, 8)).toBe(1000);
    expect(at(v, 6, 5, 3)).toBe(40);
    // The multi-frame file stores its frames top first; sorted, it matches.
    const m = await readVolume(FORMATS["DICOM multi-frame"]());
    expect(Array.from(m.data)).toEqual(Array.from(v.data));
  });

  test("a NIfTI's sform gives the same turn as the DICOM files", async () => {
    const n = await readVolume([file("phantom.nii")]);
    const d = await readVolume(dir("dicom-series"));
    expect(n.view).toEqual(d.view);
  });

  test("one DICOM slice in implicit VR reads as a single slice", async () => {
    const v = await readVolume([file("dicom-implicit.dcm")]);
    expect([v.nx, v.ny, v.nz]).toEqual([24, 20, 1]);
    expect(at(v, 12, 10, 0)).toBe(40);
  });

  test("a stack of single TIFFs (PackBits and Deflate) in name order", async () => {
    const v = await readVolume(dir("tiff-stack"));
    expect([v.nx, v.ny, v.nz]).toEqual(truth.size);
    expect(at(v, 6, 5, 8)).toBe(255);
    expect(at(v, 6, 5, 3)).toBe(Math.round((1040 / 2000) * 255));
    expect(v.notes.join(" ")).toMatch(/doesn't say its voxel size/);
  });

  test("a raw volume read with the form", async () => {
    const r = truth.raw;
    const v = await readVolume([file("phantom.raw")], {
      raw: {
        size: "24 20 12",
        type: r.type,
        little: r.little,
        spacing: "0.5 0.5 2",
        header: "auto",
      },
    });
    expect(v.spacing).toEqual(truth.spacing);
    expect(at(v, 6, 5, 8)).toBe(truth.boneHU + r.offset);
    expect(v.notes[0]).toMatch(/64 bytes/);
  });

  test("big volumes are averaged down to fit, keeping their true size", async () => {
    const v = await readVolume([file("phantom.nii")], { max: 1000 });
    expect(v.nx * v.ny * v.nz).toBeLessThanOrEqual(1000);
    for (let i = 0; i < 3; i++)
      expect([v.nx, v.ny, v.nz][i] * v.spacing[i]).toBeGreaterThanOrEqual(truth.size[i] * truth.spacing[i] - 1e-9); // prettier-ignore
    expect(v.notes.join(" ")).toMatch(/Averaged down/);
  });

  const bad = async (files, opts) => {
    try {
      await readVolume(files, opts);
    } catch (e) {
      expect(e).toBeInstanceOf(VolumeError);
      return e.message;
    }
    throw new Error("It read a bad file.");
  };
  const cut = (f, n) => ({ name: f.name, bytes: f.bytes.subarray(0, n) });

  test("truncated or wrong files say plainly what went wrong", async () => {
    const nii = file("phantom.nii");
    expect(await bad([cut(nii, 200)])).toMatch(/cut short|isn't a NIfTI|can't tell/);
    expect(await bad([cut(nii, 5000)])).toMatch(/NIfTI file is cut short/);
    const gz = file("phantom.nii.gz");
    expect(await bad([cut(gz, 120)])).toMatch(/damaged or cut-short gzip/);
    const dcm = file("dicom-multiframe.dcm");
    expect(await bad([cut(dcm, 4000)])).toMatch(/cut short/);
    const tif = file("phantom.tif");
    expect(await bad([cut(tif, 3000)])).toMatch(/cut short/);
    const zip = file("dicom-series.zip");
    expect(await bad([cut(zip, 1500)])).toMatch(/zip file is damaged or cut short/);
    expect(await bad([{ name: "notes.dat", bytes: new TextEncoder().encode("hello, not a volume at all") }])).toMatch(/raw volume form/); // prettier-ignore
    expect(await bad([{ name: "photo.webp", bytes: new Uint8Array(400).fill(7) }])).toMatch(/can't tell what photo.webp is/); // prettier-ignore
    expect(await bad([file("phantom.raw")], { raw: { size: "24 20 13", type: "uint16", header: "0" } })).toMatch(/has 11,584 bytes/); // prettier-ignore
    expect(await bad([file("phantom.raw")], { raw: { size: "24 20", type: "uint16" } })).toMatch(/three whole numbers/); // prettier-ignore
    expect(await bad([{ name: "empty.nii", bytes: new Uint8Array(0) }])).toMatch(/empty/);
  });

  test("compressed DICOM it can't read is named", async () => {
    const f = file("dicom-jpeg.dcm");
    expect(await bad([f])).toMatch(/JPEG Lossless, which Splashery can't read yet/); // prettier-ignore
  });

  test("the zip reader lists the series", async () => {
    const files = await unzip(file("dicom-series.zip").bytes);
    expect(files.length).toBe(12);
  });
});

test.describe("the view", () => {
  test("CT presets in Hounsfield units; others from the scan's histogram", async () => {
    const v = await readVolume(dir("dicom-series"));
    expect(presetWindow(v, "bone")).toEqual([300, 1500]);
    expect(presetWindow(v, "soft")).toEqual([-160, 240]);
    const custom = windowFor(v, { preset: "custom", level: 0.5, width: 0.2 });
    expect(custom[0]).toBeCloseTo(-200, 6);
    expect(custom[1]).toBeCloseTo(200, 6);
    await R.prepare({ ...defaults, source: "walnut" });
    const w = VOLUME_STATE.current;
    const s = volumeStats(w);
    // The walnut's air (about 55 of 255) is split from the rest, and its shell from its kernel.
    expect(s.air).toBeGreaterThan(40);
    expect(s.air).toBeLessThan(100);
    expect(s.dense).toBeGreaterThan(s.air + 30);
  });

  test("spacing is honored: the anisotropic phantom keeps its true shape", async () => {
    VOLUME_STATE.custom = await readVolume([file("phantom.nii")]);
    const kit = await build({ source: "custom", preset: "full" }, 40000);
    const { pos, count } = kit.buf;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++)
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a], pos[i * 3 + a]);
        hi[a] = Math.max(hi[a], pos[i * 3 + a]);
      }
    const size = hi.map((h, a) => h - lo[a]);
    // The ellipsoid is 11 mm wide, 22 mm tall (along the 2 mm slices) and 9 mm deep.
    expect(size[1] / size[0]).toBeGreaterThan(1.75);
    expect(size[1] / size[0]).toBeLessThan(2.25);
    expect(size[0] / size[2]).toBeGreaterThan(1.05);
  });

  test("the bone preset keeps only the bone, and the MIP is a flat picture", async () => {
    VOLUME_STATE.custom = await readVolume(dir("dicom-series"));
    const all = await build({ source: "custom", preset: "full" }, 40000);
    const bone = await build({ source: "custom", preset: "bone" }, 40000);
    expect(VOLUME_STATE.last.lo).toBe(300);
    // Bone's ball is small: its splats are at least as fine (the budget is the same).
    expect(VOLUME_STATE.last.pitch).toBeLessThan(0.5);
    expect(bone.buf.count).toBeGreaterThan(200);
    expect(bone.buf.count).toBeLessThan(all.buf.count / 4);
    expect(all.data.pitch).toBeGreaterThanOrEqual(VOLUME_STATE.last.pitch);
    const mip = await build({ source: "custom", view: "mip" }, 40000);
    expect(mip.data.mip).toBe(true);
    const { pos, count } = mip.buf;
    let zmax = 0;
    for (let i = 0; i < count; i++) zmax = Math.max(zmax, Math.abs(pos[i * 3 + 2]));
    expect(zmax).toBeLessThan(0.02);
  });
});

test.describe("the toy", () => {
  test("a labs Studio toy, next to Point clouds, with help, a sound and a plan entry", () => {
    const i = TOYS.findIndex((x) => x.id === "volume-viewer");
    const t = TOYS[i];
    expect(t.category).toBe("studio");
    expect(t.labs).toBe(true);
    expect(TOYS[i - 1].id).toBe("point-clouds");
    expect(TOY_HELP["volume-viewer"].howTo.length).toBeGreaterThan(20);
    expect(TOY_HELP["volume-viewer"].about.length).toBeGreaterThan(300);
    expect(toySound("volume-viewer")).toBeTruthy();
    const plan = JSON.parse(fs.readFileSync("tools/toy-plan.json", "utf8")).toys;
    expect(plan["volume-viewer"].v).toBe("keep");
    for (const s of SAMPLES) expect(s.credit.license).toBe("CC BY 4.0");
  });

  test("each sample fits the phone's budget, all volume splats", async () => {
    for (const s of SAMPLES) {
      const gz = fs.statSync(new URL(s.file, new URL("../src/packs/", import.meta.url)));
      expect(gz.size, s.id).toBeLessThan(2e6);
      for (const count of [PROFILES.low.defaultCount * 2, PROFILES.mid.defaultCount * 2]) {
        const kit = await build({ source: s.id }, Math.min(count, PROFILES.low.maxCount * 2));
        const { anim, count: n } = kit.buf;
        const cap = Math.min(count, PROFILES.low.maxCount * 2);
        expect(n, s.id).toBeGreaterThan(cap * 0.6);
        expect(n, s.id).toBeLessThan(cap * 1.1);
        let other = 0;
        for (let i = 0; i < n; i++) if (anim[i * 4 + 1] !== KINDS.volume) other++;
        expect(other, s.id).toBe(0);
      }
    }
  });

  test("the tap steps through the presets; the drag and the sweep move the cut", async () => {
    const kit = await build({ source: "walnut", preset: "full" });
    VOLUME_STATE.options = { ...defaults, preset: "full" };
    expect(R.action.at([0, 0, 0], {}).options.preset).toBe("bone");
    VOLUME_STATE.options.preset = "bone";
    expect(R.action.at([0, 0, 0], {}).options.preset).toBe("soft");
    VOLUME_STATE.options.preset = "soft";
    expect(R.action.at([0, 0, 0], {}).options.preset).toBe("full");
    const drive = (c) => {
      const out = { parts: {} };
      R.drive(1, { sweep: 0, step: 0, ...c }, out, { time: 1, data: kit.data });
      return out.volume;
    };
    expect(drive({}).normal).toBeUndefined();
    R.drag.start([0, 0, 0]);
    R.drag.move([0, -VOLUME_STATE.ext * 0.8, 0]);
    R.drag.end();
    const v = drive({});
    expect(v.normal).toEqual([0, 0, 1]);
    expect(Math.abs(v.at)).toBeLessThan(kit.data.half[2]);
    VOLUME_STATE.cut.at = 1;
    expect(drive({ sweep: 0.5 }).at).toBeLessThan(0);
    expect(describe()).toMatch(/Walnut 1/);
  });

  test("in the page: a DICOM series and a NIfTI open from the Toy tab; a bad file says why", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.goto(`${APP}&profile=low`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 120000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("volume-viewer"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.pitch, null, { timeout: 120000 }); // prettier-ignore
    // The walnut sample, within the phone's budget, and no DICOM reader loaded yet.
    const first = await page.evaluate(() => ({
      n: window.__splashery.player.proc.ctx.buf.count,
      dicom: typeof window.dicomParser,
    }));
    expect(first.n).toBeLessThanOrEqual(PROFILES.low.maxCount);
    expect(first.dicom).toBe("undefined");
    const shown = async (re) => {
      await page.waitForFunction((re) => new RegExp(re).test(document.querySelector("#vol-stats")?.textContent || ""), re.source, { timeout: 60000 }); // prettier-ignore
      return page.evaluate(() => document.querySelector("#vol-stats").textContent);
    };
    await page.setInputFiles("#toy-input-file", fs.readdirSync(path.join(FIX, "dicom-series")).map((f) => path.join(FIX, "dicom-series", f))); // prettier-ignore
    const d = await shown(/DICOM series/);
    expect(d).toMatch(/24 × 20 × 12 voxels of 500 µm × 500 µm × 2.00 mm/);
    expect(d).toMatch(/HU/);
    expect(await page.evaluate(() => typeof window.dicomParser)).toBe("object");
    await page.setInputFiles("#toy-input-file", path.join(FIX, "phantom.nii.gz"));
    expect(await shown(/NIfTI-1/)).toMatch(/24 × 20 × 12/);
    // A cut-short file: the panel's alert says so, and the volume shown stays.
    await page.setInputFiles("#toy-input-file", {
      name: "broken.nii",
      mimeType: "application/octet-stream",
      buffer: fs.readFileSync(path.join(FIX, "phantom.nii")).subarray(0, 5000),
    });
    await page.waitForFunction(() => /cut short/.test(document.querySelector("#toy-options .warning:not([hidden])")?.textContent || ""), null, { timeout: 30000 }); // prettier-ignore
    expect(await shown(/NIfTI-1/)).toMatch(/24 × 20 × 12/);
  });
});
