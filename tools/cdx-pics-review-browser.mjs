// Operator review: real rendered pixels for five links; raw 900px is a separate diagnostic.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { read } from "./cdx-pics-qr.mjs";
import { LINKS } from "./cdx-pics-links.mjs";
import { resize, blur } from "./qr-scan-lab/sim.mjs";
import { capturePicture } from "./cdx-pics-capture.mjs";

export function renderedTrials(png, codeSize, text, { rawDiagnostic = true } = {}) {
  const phone = resize(png, 330),
    printed = blur(png, (0.2 * png.width) / (codeSize + 8));
  const scans = [
    { trial: "phone-330", pixels: 330, ok: read(phone.data, 330, 330) === text },
    {
      trial: "print-900-focus",
      pixels: png.width,
      blurModules: 0.2,
      ok: read(printed.data, printed.width, printed.height) === text,
    },
  ];
  for (const ppm of [8, 4]) {
    const small = resize(png, (codeSize + 8) * ppm);
    scans.push({
      trial: "stage-scale-" + ppm,
      pixels: small.width,
      ok: read(small.data, small.width, small.height) === text,
    });
  }
  return {
    scans,
    // Screening records this expensive diagnostic once for every candidate/link.
    // Regression callers can skip it without changing any qualifying scan.
    ...(rawDiagnostic ? { raw900: read(png.data, png.width, png.height) === text } : {}),
    eligible: scans.every((s) => s.ok),
  };
}

if (process.argv[1]?.endsWith("cdx-pics-review-browser.mjs")) {
  const directory = "docs/audits/sample-pictures-2026-10/";
  const subjects = JSON.parse(fs.readFileSync(directory + "qr-review-scores.json"));
  const out = directory + "qr-review-browser.json";
  const rows = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : [];
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    window.__splashery.qrCraft.autoCheck = false;
    await window.__splashery.app.chooseToy("qr-picture");
  });
  for (const r of subjects.filter((s) => s.rasterEligible)) {
    if (rows.some((s) => s.id === r.id)) continue;
    await page.evaluate(async ({ file, id, label }) => {
      const { RECIPES } = await import("/src/packs/qr-craft.js");
      const blob = await (await fetch("/" + file)).blob();
      await RECIPES["qr-picture"].input.read(
        "",
        label,
        new File([blob], id + ".jpg", { type: "image/jpeg" }),
      );
      await window.__splashery.app.setToyOptions({ picture: "own" });
    }, r);
    const links = [];
    for (const [index, text] of LINKS.entries()) {
      await page.evaluate(
        (text) =>
          window.__splashery.app.setToyOptions({
            text,
            picture: "own",
            level: "H",
            contrast: 0.5,
            center: "small",
            style: "color",
            size: "more",
          }),
        text,
      );
      const capture = await capturePicture(page, 900, true),
        png = PNG.sync.read(Buffer.from(capture.bytes));
      if (capture.text !== text) throw Error("Wrong rendered payload: " + r.id);
      const result = renderedTrials(png, capture.codeSize, text);
      links.push({
        text,
        characters: text.length,
        options: capture.options,
        margin: capture.margin,
        ...result,
        rgbaSha256: createHash("sha256").update(png.data).digest("hex"),
      });
      if (index === 0) {
        fs.writeFileSync(
          `.cache/cdx-pics/round2/phone/${r.id}-browser.png`,
          PNG.sync.write(resize(png, 330)),
        );
        fs.writeFileSync(
          `.cache/cdx-pics/round2/phone/${r.id}-print.png`,
          Buffer.from(capture.bytes),
        );
      }
    }
    rows.push({ id: r.id, links, eligible: links.every((s) => s.eligible) });
    fs.writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
    console.log(
      `${r.id}: ${links.filter((s) => s.eligible).length}/5 rendered links, raw export ${links.filter((s) => s.raw900).length}/5`,
    );
  }
  await browser.close();
  if (errors.length) throw Error(errors.join("\n"));
}
