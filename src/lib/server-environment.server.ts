import { existsSync } from "node:fs";

/** Load the existing local server configuration without connecting to any service. */
export function loadLocalServerEnvironment(): void {
  // Hosting injects its own secrets; retain the existing Mongo URI guard and
  // native loadEnvFile precedence so local files cannot override imported values.
  if (
    process.env["MONGODB_URI"]?.trim() ||
    process.env["VITEST"] ||
    process.env["NODE_ENV"] === "test"
  ) {
    return;
  }

  for (const path of [".env.local", ".env"]) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
