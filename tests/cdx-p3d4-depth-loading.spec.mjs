import { test, expect } from "@playwright/test";
test("depth validation loads only pixel helpers and keeps geometry and models lazy", async ({
  page,
}) => {
  await page.route("**/__r4-depth-import__", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><meta charset=utf-8>" }),
  );
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/__r4-depth-import__");
  const result = await page.evaluate(async () => {
    const { createDepthEngine } = await import("/src/depth/engine.js");
    try {
      await createDepthEngine().estimate({ w: 2, h: 2, data: new Uint8Array(3) });
      return "unexpected success";
    } catch (error) {
      return error.message;
    }
  });
  expect(result).toContain("complete RGBA");
  expect(requests).toContain("/src/photo3d/pixels.js");
  expect(
    requests.filter((p) => /photo-3d-core|background|depth-edges|ort\.wasm|\.onnx$/.test(p)),
  ).toEqual([]);
});
