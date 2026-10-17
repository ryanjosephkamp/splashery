import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config.mjs";
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "sndc-*.spec.mjs",
  webServer: { ...base.webServer, cwd: new URL("../../../", import.meta.url).pathname },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

