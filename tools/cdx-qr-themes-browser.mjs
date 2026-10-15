// Screen the score-ranked candidates in the actual WebGL2 Picture QR renderer.
// A local HTTP server must serve the repository on SPLASHERY_PORT (default 4173).
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { THEMES } from "./cdx-qr-themes-art.mjs";
import { LINKS } from "./cdx-qr-themes-links.mjs";
import { passedMatrix, reusableMatrix } from "./cdx-qr-themes-evidence.mjs";
import { CACHE, EVIDENCE, hash } from "./cdx-qr-themes.mjs";
import { capturePicture } from "./cdx-qr-themes-capture.mjs";
import { renderedTrials } from "./cdx-pics-review-browser.mjs";
import { resize } from "./qr-scan-lab/sim.mjs";

const llvmpipe = process.env.SPLASHERY_GL === "llvmpipe";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  headless: !llvmpipe,
  args: [
    "--no-sandbox",
    ...(llvmpipe
      ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
      : ["--use-angle=swiftshader"]),
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(
    `http://127.0.0.1:${process.env.SPLASHERY_PORT || 4173}/?renderer=webgl2&adapt=off&profile=mid&labs=1`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    window.__splashery.qrCraft.autoCheck = false;
    await window.__splashery.app.chooseToy("qr-picture");
  });
  for (const [theme] of THEMES.filter(([id]) => !process.argv[2] || id === process.argv[2])) {
    const candidates = JSON.parse(fs.readFileSync(`${EVIDENCE}/layout-${theme}.json`))
      .filter((r) => r.eligible && passedMatrix(r, "layout"))
      .sort((a, b) => b.score - a.score);
    const out = `${EVIDENCE}/browser-${theme}.json`;
    const rows = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : [];
    const subjects = new Set();
    for (const r of candidates) {
      if (subjects.size === 8) break;
      if (subjects.has(r.motif)) continue;
      const sha256 = hash(`${CACHE}/${r.id}.jpg`),
        previous = rows.find((b) => b.id === r.id && b.sha256 === sha256);
      if (previous && reusableMatrix(previous, "browser")) {
        if (previous.eligible) subjects.add(r.motif);
        continue;
      }
      await page.evaluate(
        async ({ id, name, file }) => {
          const { RECIPES } = await import("/src/packs/qr-craft.js");
          const blob = await (await fetch("/" + file)).blob();
          await RECIPES["qr-picture"].input.read(
            "",
            name,
            new File([blob], id + ".jpg", { type: "image/jpeg" }),
          );
        },
        { ...r, file: `${CACHE}/${r.id}.jpg` },
      );
      const links = [];
      for (const [index, text] of LINKS.entries()) {
        const started = Date.now();
        await page.evaluate(
          (text) =>
            window.__splashery.app.setToyOptions({
              picture: "own",
              text,
              level: "H",
              contrast: 0.5,
              center: "small",
              style: "color",
              size: "more",
            }),
          text,
        );
        const built = Date.now();
        const capture = await capturePicture(page, 900),
          png = PNG.sync.read(Buffer.from(capture.bytes));
        const captured = Date.now();
        if (capture.text !== text || capture.options.picture !== "own")
          throw Error("Wrong rendered payload: " + r.id);
        links.push({
          text,
          characters: text.length,
          margin: capture.margin,
          codeSize: capture.codeSize,
          options: capture.options,
          ...renderedTrials(png, capture.codeSize, text),
          rgbaSha256: createHash("sha256").update(png.data).digest("hex"),
        });
        if (index === 3)
          fs.writeFileSync(`${CACHE}/${r.id}-phone.png`, PNG.sync.write(resize(png, 330)));
        console.log(
          `${r.id}: link ${index + 1}/${LINKS.length}, ${links.at(-1).eligible ? "pass" : "fail"}, build ${((built - started) / 1000).toFixed(1)}s, capture ${((captured - built) / 1000).toFixed(1)}s, decode ${((Date.now() - captured) / 1000).toFixed(1)}s`,
        );
        // A failed qualifying check disqualifies this candidate. Only retained
        // backgrounds need the complete ten-link rendered matrix.
        if (!links.at(-1).eligible) break;
      }
      const row = {
        id: r.id,
        sha256,
        renderer: llvmpipe
          ? "Chromium WebGL2, ANGLE/Mesa llvmpipe"
          : "Chromium WebGL2, ANGLE/SwiftShader",
        links,
        eligible: passedMatrix({ links }, "browser"),
      };
      const old = rows.findIndex((b) => b.id === r.id);
      if (old >= 0) rows.splice(old, 1);
      rows.push(row);
      fs.writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
      if (row.eligible) subjects.add(r.motif);
      console.log(
        `${r.id}: ${links.filter((l) => l.eligible).length}/${links.length} attempted rendered links (${LINKS.length} required); raw 900px diagnostic ${links.filter((l) => l.raw900).length}/${links.length}; ${subjects.size}/8 subjects`,
      );
    }
    if (subjects.size !== 8)
      throw Error(`${theme}: only ${subjects.size} fully qualified distinct subjects`);
  }
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
