import { defineConfig } from "@playwright/test";

// Chromium is launched through SPLASHERY_CHROMIUM when set (the cloud sandbox
// preinstalls it at /opt/pw-browsers/chromium); otherwise Playwright's own
// browser is used. SwiftShader flags give headless WebGL2 without a GPU.
const executablePath = process.env.SPLASHERY_CHROMIUM || undefined;

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  expect: { timeout: 30_000 },
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
