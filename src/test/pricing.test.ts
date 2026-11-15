import { describe, expect, it } from "vitest";

import { computeTotals, PricingError, promoDiscountCents } from "@/lib/pricing";

describe("checkout pricing", () => {
  it("applies delivery fees only below the free-delivery threshold", () => {
    const below = computeTotals({
      lines: [{ category: "burgers", lineTotalCents: 3499 }],
      fulfillment: "delivery",
    });
    const threshold = computeTotals({
      lines: [{ category: "burgers", lineTotalCents: 3500 }],
      fulfillment: "delivery",
    });

    expect(below.deliveryFeeCents).toBe(399);
    expect(threshold.deliveryFeeCents).toBe(0);
  });

  it("limits a category promo to matching items", () => {
    expect(
      promoDiscountCents(
        {
          code: "PIZZA",
          label: "Pizza",
          description: "",
          kind: "percent",
          value: 20,
          category: "pizza",
        },
        [
          { category: "pizza", lineTotalCents: 2000 },
          { category: "burgers", lineTotalCents: 1500 },
        ],
      ),
    ).toBe(400);
  });

  it("rejects invalid promo codes and points that are not in redeemable blocks", () => {
    expect(() =>
      computeTotals({
        lines: [{ category: "burgers", lineTotalCents: 3000 }],
        fulfillment: "pickup",
        promoCode: "NOTREAL",
      }),
    ).toThrow(PricingError);
    expect(() =>
      computeTotals({
        lines: [{ category: "burgers", lineTotalCents: 3000 }],
        fulfillment: "pickup",
        pointsToRedeem: 150,
        availablePoints: 1000,
      }),
    ).toThrow("Points redeem in blocks of 100");
  });
});
