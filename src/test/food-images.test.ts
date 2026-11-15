import { describe, expect, it } from "vitest";

import { foodImage } from "@/lib/food-images";

describe("menu image lookup", () => {
  it("leaves unsupported image keys blank instead of reusing unrelated food imagery", () => {
    expect(foodImage("unconfigured-dessert")).toBe("");
  });
});
