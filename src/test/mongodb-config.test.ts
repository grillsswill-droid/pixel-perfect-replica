import { afterEach, describe, expect, it } from "vitest";

import { getMongoDatabase } from "@/lib/mongodb.server";

const originalUri = process.env["MONGODB_URI"];

afterEach(() => {
  if (originalUri === undefined) delete process.env["MONGODB_URI"];
  else process.env["MONGODB_URI"] = originalUri;
});

describe("MongoDB configuration", () => {
  it("reports a missing server-side connection string before connecting", async () => {
    delete process.env["MONGODB_URI"];

    await expect(getMongoDatabase()).rejects.toThrow("Missing MONGODB_URI");
  });
});
