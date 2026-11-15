import { describe, expect, it } from "vitest";

import { saveCartSchema } from "@/lib/cart.functions";

const uuid = "00000000-0000-4000-8000-000000000001";

const validCart = {
  guestId: uuid,
  lines: [
    {
      key: `${uuid}###`,
      itemId: uuid,
      slug: "classic",
      category: "burgers",
      name: "Classic",
      imageKey: "burger",
      quantity: 1,
      selections: {},
      removed: [],
      note: "",
      unitPriceCents: 950,
      summary: [],
    },
  ],
  fulfillment: "delivery",
  storeId: uuid,
};

describe("cart persistence validation", () => {
  it("accepts a valid guest cart", () => {
    expect(saveCartSchema.safeParse(validCart).success).toBe(true);
  });

  it("rejects malformed identities and unsupported quantities", () => {
    expect(saveCartSchema.safeParse({ ...validCart, guestId: "not-an-id" }).success).toBe(false);
    expect(
      saveCartSchema.safeParse({
        ...validCart,
        lines: [{ ...validCart.lines[0], quantity: 21 }],
      }).success,
    ).toBe(false);
  });
});
