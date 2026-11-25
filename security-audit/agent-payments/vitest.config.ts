import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  envDir: false,
  cacheDir: "./security-audit/.cache/payments",
  test: {
    environment: "node",
    include: ["security-audit/agent-payments/*.test.ts"],
    maxWorkers: 1,
    testTimeout: 8000,
    hookTimeout: 8000,
    execArgv: ["--require", path.resolve("security-audit/scripts/no-network.cjs")],
  },
  resolve: { alias: { "@": path.resolve("./src") } },
});
