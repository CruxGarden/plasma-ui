import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 15000,
  use: { baseURL: "http://127.0.0.1:4175", browserName: "chromium" },
  webServer: {
    command: "node tests/browser/serve.mjs",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
  outputDir: "tests/.browser-results",
});
