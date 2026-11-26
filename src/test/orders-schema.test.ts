import { describe, expect, it } from "vitest";

import { placeOrderSchema } from "@/lib/orders.functions";

const uuid = "00000000-0000-4000-8000-000000000001";

const validOrder = {
  guestId: uuid,
  lines: [
    {
      itemId: uuid,
      quantity: 1,
      selections: {},
      removed: [],
      note: "",
    },
  ],
  fulfillment: "delivery" as const,
  storeId: uuid,
  address: {
    name: "Pat Guest",
    street: "123 Main Street",
    unit: "",
    city: "Austin",
    state: "TX",
    zip: "78701",
    phone: "5125550100",
    instructions: "",
  },
  promoCode: null,
  pointsToRedeem: 0,
  paymentLast4: "1234",
};

describe("order request validation", () => {
  it("accepts delivery without a store and requires a store for pickup", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, storeId: null }).success).toBe(true);
    expect(
      placeOrderSchema.safeParse({
        ...validOrder,
        fulfillment: "pickup",
        storeId: null,
        address: null,
        pickupName: "Pat Guest",
      }).success,
    ).toBe(false);
  });
  it("accepts a valid delivery order and normalizes its state code", () => {
    const result = placeOrderSchema.safeParse(validOrder);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address?.state).toBe("TX");
  });

  it("requires delivery details or a pickup name for each fulfillment type", () => {
    const noDeliveryAddress = placeOrderSchema.safeParse({ ...validOrder, address: null });
    const noPickupName = placeOrderSchema.safeParse({
      ...validOrder,
      fulfillment: "pickup",
      address: null,
    });

    expect(noDeliveryAddress.success).toBe(false);
    expect(noPickupName.success).toBe(false);
  });

  it("rejects malformed address and payment data", () => {
    const result = placeOrderSchema.safeParse({
      ...validOrder,
      address: { ...validOrder.address, zip: "not-a-zip" },
      paymentLast4: "123",
    });

    expect(result.success).toBe(false);
  });
});
