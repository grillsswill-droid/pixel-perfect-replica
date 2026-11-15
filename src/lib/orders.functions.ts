import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { MenuItem, OrderLineSnapshot, Store } from "./menu-types";
import type {
  AdminLogDocument,
  CounterDocument,
  GuestDocument,
  OrderDocument,
} from "./mongodb.server";
import { PricingError, computeTotals, selectionSummary, unitPriceCents } from "./pricing";

const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  street: z.string().trim().min(4, "Enter a street address").max(120),
  unit: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(2, "Enter a city").max(60),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter state code")
    .transform((s) => s.toUpperCase()),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s()+.-]{10,20}$/, "Enter a valid phone number"),
  instructions: z.string().trim().max(200).optional().default(""),
});
export const deliveryAddressSchema = addressSchema;
export type DeliveryAddress = z.infer<typeof addressSchema>;

export const placeOrderSchema = z
  .object({
    guestId: z.string().uuid(),
    lines: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantity: z.number().int().min(1).max(20),
          selections: z.record(z.array(z.string().max(40)).max(10)),
          removed: z.array(z.string().max(60)).max(20),
          note: z.string().max(140),
        }),
      )
      .min(1, "Your bag is empty")
      .max(40),
    fulfillment: z.enum(["delivery", "pickup"]),
    storeId: z.string().uuid(),
    address: addressSchema.nullable(),
    pickupName: z.string().trim().max(80).optional(),
    promoCode: z.string().trim().max(20).optional().nullable(),
    pointsToRedeem: z.number().int().min(0).max(100000),
    paymentLast4: z.string().regex(/^\d{4}$/),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && !v.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A delivery address is required",
        path: ["address"],
      });
    }
    if (v.fulfillment === "pickup" && (!v.pickupName || v.pickupName.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a name for pickup",
        path: ["pickupName"],
      });
    }
  });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/**
 * Guest checkout. Prices, promos and points are recomputed here from the database;
 * the client's numbers are display-only.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => placeOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { client, db } = await getMongoDatabase();
    const ids = [...new Set(data.lines.map((l) => l.itemId))];
    const [items, store] = await Promise.all([
      collection<MenuItem>(db, "menu_items")
        .find({ id: { $in: ids } })
        .project<MenuItem>({ _id: 0 })
        .toArray(),
      collection<Store>(db, "stores").findOne(
        { id: data.storeId },
        { projection: { _id: 0, id: 1 } },
      ),
    ]);
    if (!store) return { ok: false as const, error: "Please choose a store." };

    const byId = new Map(items.map((i) => [i.id, i]));
    const snapshots: OrderLineSnapshot[] = [];
    const priced: { category: CategoryId; lineTotalCents: number }[] = [];
    try {
      for (const line of data.lines) {
        const item = byId.get(line.itemId);
        if (!item)
          return { ok: false as const, error: "An item in your bag is no longer on the menu." };
        if (!item.is_available)
          return { ok: false as const, error: `${item.name} is sold out right now.` };
        const options = item.options;
        const removed = line.removed.filter((r) => item.ingredients.includes(r));
        const unit = unitPriceCents({ price_cents: item.price_cents, options }, line.selections);
        snapshots.push({
          itemId: item.id,
          name: item.name,
          imageKey: item.image_key,
          quantity: line.quantity,
          unitPriceCents: unit,
          summary: selectionSummary({ options }, line.selections, removed),
          selections: line.selections,
          removed,
          note: line.note,
        });
        priced.push({
          category: item.category,
          lineTotalCents: unit * line.quantity,
        });
      }

      const session = client.startSession();
      const { randomUUID } = await import("node:crypto");
      let orderNumber = 0;
      let orderId = "";
      let pointsEarned = 0;
      try {
        await session.withTransaction(async () => {
          const guests = collection<GuestDocument>(db, "guests");
          const guest = await guests.findOne({ id: data.guestId }, { session });
          const totals = computeTotals({
            lines: priced,
            fulfillment: data.fulfillment,
            promoCode: data.promoCode,
            pointsToRedeem: data.pointsToRedeem,
            availablePoints: guest?.points ?? 0,
          });
          const counters = collection<CounterDocument>(db, "counters");
          await counters.updateOne(
            { _id: "orders" },
            { $inc: { sequence: 1 } },
            { upsert: true, session },
          );
          const counter = await counters.findOne({ _id: "orders" }, { session });
          if (!counter) throw new Error("Couldn't allocate an order number.");

          const now = new Date().toISOString();
          const order: OrderDocument = {
            id: randomUUID(),
            order_number: counter.sequence + 1000,
            guest_id: data.guestId,
            status: "received",
            fulfillment: data.fulfillment,
            store_id: data.storeId,
            address: data.fulfillment === "delivery" ? data.address : null,
            items: snapshots,
            subtotal_cents: totals.subtotalCents,
            discount_cents: totals.discountCents,
            promo_code: totals.promoCode,
            points_redeemed: totals.pointsRedeemed,
            delivery_fee_cents: totals.deliveryFeeCents,
            tax_cents: totals.taxCents,
            total_cents: totals.totalCents,
            points_earned: totals.pointsEarned,
            payment_last4: data.paymentLast4,
            customer_name: data.fulfillment === "delivery" ? data.address!.name : data.pickupName!,
            created_at: now,
            updated_at: now,
          };
          await collection<OrderDocument>(db, "orders").insertOne(order, { session });
          await guests.updateOne(
            { id: data.guestId },
            {
              $set: {
                points: (guest?.points ?? 0) - totals.pointsRedeemed + totals.pointsEarned,
                lifetime_points: (guest?.lifetime_points ?? 0) + totals.pointsEarned,
              },
              $setOnInsert: { created_at: now },
            },
            { upsert: true, session },
          );

          const log: AdminLogDocument = {
            id: randomUUID(),
            admin_id: null,
            action: "order_created",
            details: { order_id: order.id, order_number: order.order_number },
            created_at: now,
          };
          await collection<AdminLogDocument>(db, "admin_logs").insertOne(log, { session });
          orderNumber = order.order_number;
          orderId = order.id;
          pointsEarned = totals.pointsEarned;
        });
      } finally {
        await session.endSession();
      }

      return {
        ok: true as const,
        orderId,
        orderNumber,
        pointsEarned,
      };
    } catch (e) {
      if (e instanceof PricingError) return { ok: false as const, error: e.message };
      throw e;
    }
  });

export const getGuestRewards = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ guestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const [guest, orders] = await Promise.all([
      collection<GuestDocument>(db, "guests").findOne(
        { id: data.guestId },
        { projection: { _id: 0, points: 1, lifetime_points: 1, created_at: 1 } },
      ),
      collection<OrderDocument>(db, "orders")
        .find({ guest_id: data.guestId })
        .project<
          Pick<
            OrderDocument,
            | "id"
            | "order_number"
            | "status"
            | "fulfillment"
            | "store_id"
            | "items"
            | "total_cents"
            | "points_earned"
            | "created_at"
          >
        >({ _id: 0 })
        .sort({ created_at: -1 })
        .limit(12)
        .toArray(),
    ]);
    return {
      points: guest?.points ?? 0,
      lifetimePoints: guest?.lifetime_points ?? 0,
      orders,
    };
  });

/** Order IDs are unguessable; the tracking link works like a receipt. */
export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const order = await collection<OrderDocument>(db, "orders").findOne(
      { id: data.id },
      { projection: { _id: 0 } },
    );
    if (!order) return null;
    const store = await collection<Store>(db, "stores").findOne(
      { id: order.store_id },
      { projection: { _id: 0, name: 1, address: 1, city: 1, state: 1, phone: 1 } },
    );
    return {
      ...order,
      address: order.address,
      stores: store,
    };
  });
