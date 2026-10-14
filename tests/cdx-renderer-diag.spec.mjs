import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import {
  beginRendererDiagnostics,
  observeGraphicsDevice,
  errorReport,
  rendererReportText,
  watchFirstToyFrame,
} from "../src/renderer-diagnostics.js";

function fakeCanvas(getContext = () => null) {
  const canvas = new EventTarget();
  canvas.getContext = getContext;
  canvas.dataset = {};
  canvas.ownerDocument = { getElementById: () => null };
  return canvas;
}

async function settled(page, url) {
  await page.goto(url);
  await expect(page.locator("body")).toHaveAttribute("data-page-settled", "true");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
}

async function report(page) {
  await page.locator("#renderer-details summary").click();
  const text = await page.locator("#renderer-report").inputValue();
  return JSON.parse(text.slice(text.indexOf("{")));
}

async function denyWebGL(page, { adapter = "absent", context = "null" } = {}) {
  await page.addInitScript(
    ({ adapter, context }) => {
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value:
          adapter === "absent"
            ? undefined
            : {
                requestAdapter() {
                  if (adapter === "reject") {
                    return Promise.reject(
                      new Error("Adapter policy denied", {
                        cause: new Error("Adapter root cause"),
                      }),
                    );
                  }
                  return Promise.resolve(null);
                },
              },
      });
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === "webgl2") {
          if (context === "throw") {
            throw new Error("Context policy denied <script>", {
              cause: new Error("Context root cause"),
            });
          }
          this.dispatchEvent(
            new WebGLContextEvent("webglcontextcreationerror", {
              statusMessage: "No graphics device for this test",
            }),
          );
          return null;
        }
        return original.call(this, type, ...args);
      };
    },
    { adapter, context },
  );
}

test("the device boundary preserves options, error identity, and nested causes (unit)", async () => {
  const context = {};
  const canvas = fakeCanvas(() => context);
  const original = canvas.getContext;
  const diagnostics = beginRendererDiagnostics(canvas, "webgl2", {});
  const options = { deviceTypes: ["webgl2"], antialias: false };
  const root = new Error("Underlying policy");
  const error = new TypeError("Device setup failed", { cause: root });
  const create = (actualCanvas, actualOptions) => {
    expect(actualCanvas).toBe(canvas);
    expect(actualOptions).toBe(options);
    expect(canvas.getContext("webgl2")).toBe(context);
    throw error;
  };
  await expect(observeGraphicsDevice(create, canvas, options)).rejects.toBe(error);
  expect(diagnostics.originalError).toBe(error);
  diagnostics.finish(error);
  expect(canvas.getContext).toBe(original);
  expect(diagnostics.report.webgl2.outcome).toBe("created");
  expect(diagnostics.report.finalError.cause.message).toBe("Underlying policy");
});

test("observation adds no probes and overlapping players restore shared methods (unit)", async () => {
  const adapter = { requestDevice: () => Promise.resolve({}) };
  const gpu = { requestAdapter: () => Promise.resolve(adapter) };
  const original = gpu.requestAdapter;
  const originalDevice = adapter.requestDevice;
  const a = beginRendererDiagnostics(fakeCanvas(), "auto", { gpu });
  const b = beginRendererDiagnostics(fakeCanvas(), "auto", { gpu });
  expect(a.report.adapter.calls).toEqual([]);
  expect(b.report.adapter.calls).toEqual([]);
  const result = await gpu.requestAdapter();
  expect(result).toBe(adapter);
  await adapter.requestDevice();
  a.finish();
  expect(gpu.requestAdapter).not.toBe(original);
  b.finish();
  expect(gpu.requestAdapter).toBe(original);
  expect(adapter.requestDevice).toBe(originalDevice);
  expect(a.report.adapter.outcome).toBe("available");
  expect(b.report.webgpuDevice.outcome).toBe("created");
});

test("locked APIs and circular causes are reported without changing capabilities (unit)", () => {
  const canvas = fakeCanvas();
  const original = canvas.getContext;
  Object.defineProperty(canvas, "getContext", { configurable: false, writable: false });
  const diagnostics = beginRendererDiagnostics(canvas, "none", {});
  const error = new Error("Root");
  error.cause = error;
  diagnostics.finish(error);
  expect(canvas.getContext).toBe(original);
  expect(diagnostics.report.webgl2.outcome).toBe("not attempted");
  expect(diagnostics.report.observationLimits).toContain("getContext could not be observed");
  expect(rendererReportText(diagnostics.report)).toContain("[Circular cause]");
  expect(errorReport("primitive failure").message).toBe("primitive failure");
});

test("ticks, empty renders, and data loading cannot announce a first toy frame (unit)", () => {
  const callbacks = new Map();
  const app = {
    renderer: { _gsplatCount: 0 },
    on: (name, fn) => callbacks.set(name, fn),
    off: (name) => callbacks.delete(name),
  };
  const emitted = [];
  const player = {
    canvas: fakeCanvas(),
    stage: { app, device: { _drawCallsPerFrame: 2, contextLost: false } },
    toyInfo: null,
    loading: 0,
    emit: (name) => emitted.push(name),
  };
  watchFirstToyFrame(player);
  callbacks.get("frameend")();
  expect(emitted).toEqual([]);
  player.toyInfo = { id: "cactus" };
  callbacks.get("postrender")();
  callbacks.get("frameend")();
  expect(emitted).toEqual([]);
  app.renderer._gsplatCount = 20;
  player.loading = 1;
  callbacks.get("postrender")();
  callbacks.get("frameend")();
  expect(emitted).toEqual([]);
  player.loading = 0;
  callbacks.get("postrender")();
  callbacks.get("frameend")();
  expect(emitted).toEqual(["first-toy-frame"]);
  expect(player.canvas.dataset.firstToyFrame).toBe("true");
  expect(callbacks.size).toBe(0);
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`forced-off fallback has a poster and a readable local report at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await settled(page, "/?renderer=none");
    await expect(page.locator("#fallback")).toBeVisible();
    await expect(page.locator("#fallback .poster")).toBeVisible();
    await expect(page.locator("#stage")).toBeHidden();
    await expect(page.locator("#fallback-reason")).toContainText("may help");
    await expect(page.locator("#fallback-reason")).toContainText("no graphics device");
    await expect(page.locator("body")).toHaveAttribute("data-renderer-ready", "false");
    await expect(page.locator("body")).toHaveAttribute("data-first-toy-frame", "false");
    const data = await report(page);
    expect(data.preference).toBe("none");
    expect(data.attemptedBackends).toEqual([]);
    expect(data.adapter.outcome).toBe("not requested");
    expect(data.webgl2.outcome).toBe("not attempted");
    expect(data.finalError.message).toContain("switched off");
    const bounds = await page.locator("#renderer-report").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(page.locator("#renderer-report")).toHaveAttribute("readonly", "");
    await page.screenshot({ path: `tests/screenshots/cdx-renderer-diag-${width}x${height}.png` });
  });
}

test("no WebGPU API and no WebGL2 context retain the actual device error", async ({ page }) => {
  await denyWebGL(page);
  await settled(page, "/?profile=weak");
  const data = await report(page);
  expect(data.webgpuApi).toBe(false);
  expect(data.adapter.outcome).toBe("not requested");
  expect(data.requestedBackends).toEqual(["webgl2"]);
  expect(data.attemptedBackends).toEqual(["webgl2"]);
  expect(data.webgl2.outcome).toBe("unavailable");
  expect(data.webgl2.contextErrors).toContain("No graphics device for this test");
  expect(data.finalError.cause.message).toBe("WebGL not supported");
  expect(
    await page.evaluate(
      () =>
        window.__splashery.app.player.rendererDiagnostics.error.cause ===
        window.__splashery.app.player.rendererDiagnostics.originalError,
    ),
  ).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-first-toy-frame", "false");
});

test("an exposed WebGPU API returning no adapter is not described as working", async ({ page }) => {
  await denyWebGL(page, { adapter: "null" });
  await settled(page, "/?profile=weak");
  const data = await report(page);
  expect(data.webgpuApi).toBe(true);
  expect(data.adapter.outcome).toBe("no adapter");
  expect(data.adapter.calls).toEqual([{ outcome: "no adapter", error: null }]);
  expect(data.attemptedBackends).toEqual(["webgl2"]);
  expect(data.backend).toBeNull();
});

test("an adapter rejection retains its cause while WebGL2 is tried", async ({ page }) => {
  await denyWebGL(page, { adapter: "reject" });
  await settled(page, "/?profile=weak");
  const data = await report(page);
  expect(data.adapter.outcome).toBe("error");
  expect(data.adapter.calls[0].error).toMatchObject({
    message: "Adapter policy denied",
    cause: { message: "Adapter root cause" },
  });
  expect(data.webgl2.outcome).toBe("unavailable");
  expect(data.finalError.cause.message).toBe("WebGL not supported");
});

test("a thrown context error keeps both exception layers and renders as text", async ({ page }) => {
  await denyWebGL(page, { context: "throw" });
  await settled(page, "/?renderer=webgl2&profile=weak");
  const data = await report(page);
  expect(data.webgl2.outcome).toBe("error");
  expect(data.finalError.cause).toMatchObject({
    message: "Context policy denied <script>",
    cause: { message: "Context root cause" },
  });
  expect(await page.locator("#renderer-details script").count()).toBe(0);
  expect(
    await page.evaluate(() => Object.hasOwn(document.getElementById("stage"), "getContext")),
  ).toBe(false);
});

test("the embed fallback has separate states and its own report", async ({ page }) => {
  await settled(page, "/embed/?renderer=none");
  await expect(page.locator("#fallback .poster")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-renderer-ready", "false");
  await expect(page.locator("body")).toHaveAttribute("data-first-toy-frame", "false");
  const data = await report(page);
  expect(data.finalError.message).toContain("switched off");
  expect(data.attemptedBackends).toEqual([]);
});

test("copying a report stays local, and clipboard denial selects it for manual copy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.diagCopies = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.diagCopies.push(text);
        },
      },
    });
    const fail = () => {
      throw new Error("Unexpected storage write");
    };
    Storage.prototype.setItem = fail;
    Storage.prototype.removeItem = fail;
  });
  await settled(page, "/?renderer=none");
  await report(page);
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Copy report" }).click();
  await expect(page.locator("#renderer-details [role=status]")).toHaveText("Copied.");
  expect(await page.evaluate(() => window.diagCopies)).toEqual([
    await page.locator("#renderer-report").inputValue(),
  ]);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Denied");
    };
  });
  await page.getByRole("button", { name: "Copy report" }).click();
  await expect(page.locator("#renderer-details [role=status]")).toHaveText(
    "Select and copy the report.",
  );
  expect(
    await page.locator("#renderer-report").evaluate((el) => el.selectionEnd - el.selectionStart),
  ).toBeGreaterThan(100);
  expect(requests).toEqual([]);
});

for (const [name, url] of [
  ["app", "/?renderer=webgl2&profile=weak"],
  ["embed", "/embed/?renderer=webgl2&profile=weak"],
]) {
  test(`${name} smoke requires an initialized backend and an actual toy frame with pixels`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    // Delay the first asset to separate renderer initialization from toy data.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/toys/cactus/*.sog", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(url);
    try {
      await expect(page.locator("body")).toHaveAttribute("data-renderer-ready", "true");
      await expect(page.locator("body")).toHaveAttribute("data-first-toy-frame", "false");
    } finally {
      release();
    }
    await expect(page.locator("body")).toHaveAttribute("data-page-settled", "true");
    await expect(page.locator("body")).toHaveAttribute("data-first-toy-frame", "true");
    expect(await page.evaluate(() => window.__splashery.player.stage.device.deviceType)).toBe(
      "webgl2",
    );
    await expect(page.locator("#fallback")).toBeHidden();
    const png = PNG.sync.read(await page.locator("#stage").screenshot());
    let ink = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (Math.min(png.data[i], png.data[i + 1], png.data[i + 2]) < 235) ink++;
    }
    expect(ink).toBeGreaterThan(2000);
  });
}
