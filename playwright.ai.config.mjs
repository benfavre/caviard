import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ai",
  testMatch: "*.spec.mjs",
  workers: 1,
  timeout: 300000,
  expect: { timeout: 15000 },
  outputDir: "test-results/ai",
  reporter: [
    ["list"],
    ["json", { outputFile: "output/test-report/ai-real.json" }],
  ],
});
