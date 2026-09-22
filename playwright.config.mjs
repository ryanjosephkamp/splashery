import { defineConfig } from "@playwright/test";

// Chromium is launched through SPLASHERY_CHROMIUM when set (the cloud sandbox
// preinstalls it at /opt/pw-browsers/chromium); otherwise Playwright's own
// browser is used. SwiftShader flags give headless WebGL2 without a GPU, and
// the Vulkan flags let the same SwiftShader back WebGPU where Chromium allows
// it. WebGL2 tests force ?renderer=webgl2; WebGPU tests skip themselves with a
// message when no adapter is available.
const executablePath = process.env.SPLASHERY_CHROMIUM || undefined;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath,
      args: [
        "--use-angle=swiftshader",
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
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
