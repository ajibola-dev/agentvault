import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    ignoreHTTPSErrors: true,
  },
  reporter: [["list"]],
});
