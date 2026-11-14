export type OrderStatus = "received" | "kitchen" | "handoff" | "completed" | "cancelled";
export const STATUS_FLOW: Exclude<OrderStatus, "cancelled">[] = ["received", "kitchen", "handoff", "completed"];

/** Seconds after the order is placed when the simulated tracker moves to each stage. */
export const SIMULATED_STAGE_SECONDS: Record<Exclude<OrderStatus, "cancelled">, number> = {
  received: 0,
  kitchen: 45,
  handoff: 150,
  completed: 330,
};

export function statusLabel(status: OrderStatus, fulfillment: "delivery" | "pickup"): string {
  switch (status) {
    case "received":
      return "Order Received";
    case "kitchen":
      return "Fired to Kitchen";
    case "handoff":
      return fulfillment === "delivery" ? "Out for Delivery" : "Ready for Pickup";
    case "completed":
      return fulfillment === "delivery" ? "Delivered" : "Picked Up";
    case "cancelled":
      return "Cancelled";
  }
}

/**
 * The tracker shows whichever is further along: the status staff set in the kitchen
 * dashboard, or the simulated timeline since the order was placed. Cancelled always wins.
 */
export function effectiveStatus(dbStatus: OrderStatus, createdAt: string | Date, now: Date = new Date()): OrderStatus {
  if (dbStatus === "cancelled") return "cancelled";
  const elapsed = (now.getTime() - new Date(createdAt).getTime()) / 1000;
  let simulated: OrderStatus = "received";
  for (const s of STATUS_FLOW) if (elapsed >= SIMULATED_STAGE_SECONDS[s]) simulated = s;
  return STATUS_FLOW.indexOf(dbStatus) >= STATUS_FLOW.indexOf(simulated as (typeof STATUS_FLOW)[number])
    ? dbStatus
    : simulated;
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === "cancelled" || status === "completed") return null;
  return STATUS_FLOW[STATUS_FLOW.indexOf(status) + 1] ?? null;
}
