import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  envDir: false,
  cacheDir: "./security-audit/agent-backend/.cache",
  test: {
    environment: "node",
    include: ["security-audit/agent-backend/*.test.ts"],
    maxWorkers: 1,
    testTimeout: 8000,
    hookTimeout: 8000,
    execArgv: ["--require", path.resolve("security-audit/scripts/no-network.cjs")],
  },
  resolve: { alias: { "@": path.resolve("./src") } },
});
