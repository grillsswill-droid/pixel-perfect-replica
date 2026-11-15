import { describe, expect, it } from "vitest";

import { requireMongoUri } from "@/lib/mongodb.server";

describe("MongoDB configuration", () => {
  it("reports a missing server-side connection string before connecting", () => {
    expect(() => requireMongoUri(undefined)).toThrow("Missing MONGODB_URI");
    expect(() => requireMongoUri("  ")).toThrow("Missing MONGODB_URI");
  });

  it("trims a configured connection string", () => {
    expect(requireMongoUri(" mongodb://localhost:27017 ")).toBe("mongodb://localhost:27017");
  });
});
