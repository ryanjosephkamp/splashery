import { defineConfig } from "@playwright/test";

// Chromium is launched through SPLASHERY_CHROMIUM when set (the cloud sandbox
// preinstalls it at /opt/pw-browsers/chromium); otherwise Playwright's own
// browser is used. SwiftShader flags give headless WebGL2 without a GPU, and
// the Vulkan flags let the same SwiftShader back WebGPU where Chromium allows
// it. WebGL2 tests force ?renderer=webgl2; WebGPU tests skip themselves with a
// message when no adapter is available.
const executablePath = process.env.SPLASHERY_CHROMIUM || undefined;
// SPLASHERY_PORT gives each local lane on one computer its own server (OPERATING.md, "Local
// lanes"); everyone else keeps 4173.
const port = Number(process.env.SPLASHERY_PORT) || 4173;
// SPLASHERY_GL=llvmpipe (docs/OPERATING.md, "Running the suite fast"): WebGL2 through ANGLE on
// Mesa's llvmpipe instead of SwiftShader, which draws the same frames two to three times faster on
// the cloud container. Chromium reaches desktop GL only with a window, so the browser runs headed
// on a virtual display (Xvfb; tools/suite.mjs starts one). WebGPU stays on SwiftShader.
const llvmpipe = process.env.SPLASHERY_GL === "llvmpipe";
// Headed, Chromium would draw scrollbars that headless hides, so they stay hidden here too.
const gl = llvmpipe
  ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
  : ["--use-angle=swiftshader"];

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath,
      ...(llvmpipe ? { headless: false } : {}),
      args: [
        ...gl,
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
        "--disable-gpu-driver-bug-workarounds",
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan,WebGPU",
        "--use-webgpu-adapter=swiftshader",
        "--use-vulkan=swiftshader",
      ],
    },
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
