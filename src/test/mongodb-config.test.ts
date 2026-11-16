import { afterEach, describe, expect, it } from "vitest";

import { requireMongoUri } from "@/lib/mongodb.server";
import { staffSessionConfig } from "@/lib/staff.functions";

describe("MongoDB configuration", () => {
  it("reports a missing server-side connection string before connecting", () => {
    expect(() => requireMongoUri(undefined)).toThrow("Missing MONGODB_URI");
    expect(() => requireMongoUri("  ")).toThrow("Missing MONGODB_URI");
  });

  it("trims a configured connection string", () => {
    expect(requireMongoUri(" mongodb://localhost:27017 ")).toBe("mongodb://localhost:27017");
  });
});

describe("Staff session configuration", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  const originalSessionSecret = process.env["SESSION_SECRET"];

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalNodeEnv;
    }

    if (originalSessionSecret === undefined) {
      delete process.env["SESSION_SECRET"];
    } else {
      process.env["SESSION_SECRET"] = originalSessionSecret;
    }
  });

  it("uses secure cookies only in production", () => {
    process.env["SESSION_SECRET"] = "1234567890abcdefghijklmnopqrstuv";
    process.env["NODE_ENV"] = "development";
    expect(staffSessionConfig().cookie.secure).toBe(false);

    process.env["NODE_ENV"] = "production";
    expect(staffSessionConfig().cookie.secure).toBe(true);
  });
});
