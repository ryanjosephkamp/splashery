import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

test("all 108 printed contents numbers share one right edge", async ({ page }, info) => {
  test.setTimeout(180000);
  const pdf = info.outputPath("manual.pdf");
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["tools/manual-pdf.mjs", pdf, "--allow-other-browser", "--allow-other-fonts"],
    { env: { ...process.env, SPLASHERY_URL: info.project.use.baseURL + "/" } },
  );
  await info.attach("print checks", { body: stdout, contentType: "text/plain" });
  await page.goto("/manual/all.html");
  const numbers = await page.evaluate(
    async (bytes) => {
      const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
      const doc = await task.promise;
      const numbers = [];
      for (let n = 1; n <= 4; n++) {
        for (const item of (await (await doc.getPage(n)).getTextContent()).items)
          if (/^p\.\s*\d+$/.test(item.str))
            numbers.push({ text: item.str, right: item.transform[4] + item.width });
      }
      await task.destroy();
      return numbers;
    },
    [...fs.readFileSync(pdf)],
  );
  expect(numbers).toHaveLength(108);
  const edges = numbers.map((n) => n.right);
  expect(Math.max(...edges) - Math.min(...edges)).toBeLessThan(1);
});

test("manual sharing instructions use the app's current action names", async ({ page }) => {
  for (const path of ["/manual/share.html", "/manual/all.html"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(/Save JSON|Load JSON/);
    await expect(page.locator("body")).toContainText("Save scene");
  }
});
