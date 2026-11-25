import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  envDir: false,
  plugins: [react()],
  cacheDir: "./security-audit/.cache/existing",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    maxWorkers: 2,
    testTimeout: 8000,
    hookTimeout: 8000,
    execArgv: ["--require", path.resolve("security-audit/scripts/no-network.cjs")],
  },
  resolve: { alias: { "@": path.resolve("./src") } },
});
