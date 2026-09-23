import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/desktop",
  testMatch: "*.spec.mjs",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: "test-results/desktop",
  reporter: [
    ["list"],
    ["json", { outputFile: "output/test-report/desktop.json" }],
  ],
});
