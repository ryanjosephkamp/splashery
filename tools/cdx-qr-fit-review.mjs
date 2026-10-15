// Phone and desktop evidence only. Commit the output to the clips branch,
// never to the implementation branch. No new source pictures are generated.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { BORDER_CHOICES, EYE_CHOICES, pictureEyeChoices } from "../src/qr/fit-options.js";
import { readBoth } from "./cdx-circle-study.mjs";
import { readZxingCpp } from "./qrs-study/readers.mjs";
import { resize } from "./qr-scan-lab/sim.mjs";

const out = process.argv[2] || ".cache/picture-qr-fit-review";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const rows = [];
const text = "https://example.org/fit-your-picture";
const variants = [
  ...["square", "circle"].flatMap((shape) =>
    EYE_CHOICES.map((eye) => ({
      name: `${shape}-eyes-${eye.id}`,
      shape,
      eyeShape: eye.id,
      circleBorder: "legacy",
    })),
  ),
  ...BORDER_CHOICES.filter((b) => b.id !== "legacy").map((b) => ({
    name: `circle-border-${b.id}`,
    shape: "circle",
    eyeShape: "style",
    circleBorder: b.id,
  })),
];
try {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(
      `http://127.0.0.1:${process.env.SPLASHERY_PORT || 4175}/?renderer=webgl2&adapt=off&profile=mid&labs=1`,
    );
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    for (const id of ["qr-code", "qr-picture"]) {
      await page.evaluate(async (id) => {
        const { app } = window.__splashery;
        await app.chooseToy(id);
        if (id === "qr-code") window.__splashery.qr.autoCheck = false;
        else window.__splashery.qrCraft.autoCheck = false;
      }, id);
      const shots = async (variant) => {
        const check = await page.evaluate(
          async ({ options, id }) => {
            const { app, qr, qrCraft } = window.__splashery;
            await app.setToyOptions(options);
            if (id === "qr-code") {
              const checked = await qr.check();
              if (!checked?.ok) throw new Error("The built-in QR check failed.");
              qr.scanView();
              return checked;
            }
            const checked = await qrCraft.checkPicture();
            if (!checked?.ok || !checked.stage?.every((s) => s.ok))
              throw new Error("The built-in Picture QR checks failed.");
            return { ok: checked.ok, sizes: checked.sizes, stage: checked.stage };
          },
          {
            id,
            options: {
              text,
              ...(id === "qr-picture" ? { size: "fit", level: "H" } : { ecc: "auto" }),
              plate: "none",
              ...variant,
            },
          },
        );
        const shot = await page.evaluate(
          (id) =>
            id === "qr-code"
              ? window.__splashery.qr.lastShot()
              : window.__splashery.qrCraft.lastShot(),
          id,
        );
        const phone = resize(PNG.sync.read(Buffer.from(shot.split(",")[1], "base64")), 390);
        const read = { ...readBoth(phone), zxingcpp: await readZxingCpp(phone) };
        if (Object.values(read).some((r) => r !== text))
          throw new Error(`Failed review render: ${id}/${variant.name}: ${JSON.stringify(read)}`);
        const name = `cdx-qr-fit-${id}-${variant.name}-${width}x${height}.png`;
        await page.screenshot({ path: path.join(out, name) });
        rows.push({ id, name, width, height, options: variant, check, reads: read });
        console.log(name);
      };
      for (const variant of variants) {
        if (
          id === "qr-picture" &&
          !pictureEyeChoices(variant.shape).some((e) => e.id === variant.eyeShape)
        )
          continue;
        await shots(variant);
      }
      if (width === 390) await page.locator("#sheet-toggle").click();
      await page.getByLabel("Circle border", { exact: true }).scrollIntoViewIfNeeded();
      const controls = `cdx-qr-fit-controls-${id}-${width}x${height}.png`;
      await page.screenshot({ path: path.join(out, controls) });
      rows.push({ id, name: controls, width, height, controls: true });
      if (width === 390) await page.locator("#sheet-toggle").click();
      if (id === "qr-picture") {
        for (const shape of ["square", "circle"]) {
          await page.evaluate(
            (shape) =>
              window.__splashery.app.setToyOptions({
                shape,
                circleBorder: "legacy",
                eyeShape: "style",
              }),
            shape,
          );
          await page.evaluate(() => {
            window.__qrFitPriorWoven = window.__splashery.qrCraft.picture().woven;
          });
          await page
            .locator("#toy-input-file")
            .setInputFiles("assets/toys/photo-3d/wildflowers.jpg");
          await page.waitForFunction(
            () =>
              window.__splashery.qrCraft.picture()?.woven !== window.__qrFitPriorWoven &&
              window.__splashery.qrCraft.picture()?.options?.picture === "own" &&
              !window.__splashery.app.busy,
          );
          await shots({
            name: `${shape}-crop-before`,
            shape,
            picture: "own",
            pictureFit: "code",
            cropX: 0.5,
            cropY: 0.5,
            cropZoom: 1,
            circleBorder: "legacy",
            eyeShape: "style",
          });
          await shots({
            name: `${shape}-crop-after`,
            shape,
            picture: "own",
            pictureFit: shape === "circle" ? "circle" : "code",
            cropX: 0.85,
            cropY: 0.3,
            cropZoom: 1.6,
            circleBorder: "legacy",
            eyeShape: "style",
          });
          if (width === 390) await page.locator("#sheet-toggle").click();
          await page.locator("#qrc-crop").evaluate((e) => {
            e.open = true;
          });
          if (width > 760)
            await page.getByRole("separator", { name: "Shelf height", exact: true }).press("Home");
          await page.getByLabel("Crop preview").scrollIntoViewIfNeeded();
          await page.getByLabel("Crop preview").evaluate((canvas) => {
            const pane = canvas.closest(".panes");
            pane.scrollTop +=
              canvas.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
          });
          const name = `cdx-qr-fit-crop-editor-${shape}-${width}x${height}.png`;
          await page.screenshot({ path: path.join(out, name) });
          rows.push({
            id,
            name,
            width,
            height,
            source: "assets/toys/photo-3d/wildflowers.jpg",
            editor: true,
          });
          if (width === 390) await page.locator("#sheet-toggle").click();
        }
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    path.join(out, "review.json"),
    JSON.stringify(
      {
        text,
        viewports: [
          [390, 844],
          [1440, 900],
        ],
        errors,
        rows,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
