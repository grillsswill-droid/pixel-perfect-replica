import { afterEach, describe, expect, it } from "vitest";

import {
  initializeFlutterwavePaymentSchema,
  verifyFlutterwaveWebhookHash,
} from "@/lib/payments.server";

const uuid = "00000000-0000-4000-8000-000000000001";
const originalSecretHash = process.env["FLW_SECRET_HASH"];

const validPayment = {
  guestId: uuid,
  requestId: "00000000-0000-4000-8000-000000000002",
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
    state: "tx",
    zip: "78701",
    phone: "5125550100",
    instructions: "",
  },
  promoCode: null,
  pointsToRedeem: 0,
  email: "PAT@example.com",
  name: "Pat Guest",
  phone_number: "+1 512 555 0100",
  amount: 42.5,
  currency: "USD" as const,
};

afterEach(() => {
  if (originalSecretHash === undefined) delete process.env["FLW_SECRET_HASH"];
  else process.env["FLW_SECRET_HASH"] = originalSecretHash;
});

describe("Flutterwave payment request validation", () => {
  it("accepts checkout details and normalizes email and state", () => {
    const result = initializeFlutterwavePaymentSchema.parse(validPayment);

    expect(result.email).toBe("pat@example.com");
    expect(result.address?.state).toBe("TX");
    expect(result.amount).toBe(42.5);
  });

  it("rejects invalid customer data and sub-cent amounts", () => {
    expect(
      initializeFlutterwavePaymentSchema.safeParse({
        ...validPayment,
        email: "not-an-email",
        amount: 42.501,
      }).success,
    ).toBe(false);
  });
});

describe("Flutterwave webhook verification", () => {
  it("compares verif-hash using the configured secret", () => {
    process.env["FLW_SECRET_HASH"] = "test-webhook-secret";

    expect(verifyFlutterwaveWebhookHash("test-webhook-secret")).toBe(true);
    expect(verifyFlutterwaveWebhookHash("wrong-secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash(null)).toBe(false);
  });
});
