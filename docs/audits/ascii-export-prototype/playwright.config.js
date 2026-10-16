// The repository config discovers .spec.mjs; keep the owner's .spec.js path
// without changing the shared runner. Never reuse another lane's server.
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../../playwright.config.mjs";

export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL("../../../tests", import.meta.url)),
  testMatch: "ascii-export.spec.js",
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    reuseExistingServer: false,
  },
});
