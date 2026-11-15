import { describe, expect, it } from "vitest";

import { effectiveStatus, statusLabel } from "@/lib/order-status";

describe("order status tracking", () => {
  it("uses the further-along staff or simulated status, while cancellation wins", () => {
    const createdAt = new Date("2026-11-15T00:00:00Z");
    const now = new Date("2026-11-15T00:03:00Z");

    expect(effectiveStatus("received", createdAt, now)).toBe("handoff");
    expect(effectiveStatus("cancelled", createdAt, now)).toBe("cancelled");
  });

  it("labels the handoff differently for delivery and pickup", () => {
    expect(statusLabel("handoff", "delivery")).toBe("Out for Delivery");
    expect(statusLabel("handoff", "pickup")).toBe("Ready for Pickup");
  });
});
