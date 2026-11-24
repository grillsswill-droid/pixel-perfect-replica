import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CategoryId, MenuItem, OrderLineSnapshot, Store } from "./menu-types";
import type {
  AdminLogDocument,
  CounterDocument,
  GuestDocument,
  OrderDocument,
  UserDocument,
} from "./mongodb.server";
import {
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  PROMOS,
  PricingError,
  bundleComponentsFor,
  computeTotals,
  selectionSummary,
  validateMenuBundle,
  unitPriceCents,
  type PromoDefinition,
} from "./pricing";

type StorefrontPricingSettings = {
  _id: string;
  delivery_fee_cents?: number;
  free_delivery_threshold_cents?: number;
  points_per_dollar?: number;
  points_per_dollar_redeemed?: number;
};

type StoredPromotion = PromoDefinition & {
  id: string;
  usage_limit?: number;
  usage_count?: number;
  active: boolean;
};

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
    requestId: z.string().uuid().optional(),
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
  .validator((data: unknown) => placeOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { client, db } = await getMongoDatabase();
    const { randomUUID } = await import("node:crypto");
    const requestId = data.requestId ?? randomUUID();

    const existing = await collection<OrderDocument>(db, "orders").findOne(
      { guest_id: data.guestId, checkout_request_id: requestId },
      { projection: { _id: 0, id: 1, order_number: 1, points_earned: 1, receipt_number: 1 } },
    );
    if (existing) {
      const { createOrderAccessToken } = await import("./order-access.server");
      return {
        ok: true as const,
        orderId: existing.id,
        orderNumber: existing.order_number,
        receiptNumber:
          existing.receipt_number ?? `GS-${String(existing.order_number).padStart(6, "0")}`,
        accessToken: createOrderAccessToken(existing.id, data.guestId),
        pointsEarned: existing.points_earned,
      };
    }

    const ids = [...new Set(data.lines.map((l) => l.itemId))];
    const [items, store, settings, storedPromotion] = await Promise.all([
      collection<MenuItem>(db, "menu_items")
        .find({ id: { $in: ids } })
        .project<MenuItem>({ _id: 0 })
        .toArray(),
      collection<Store>(db, "stores").findOne(
        { id: data.storeId },
        { projection: { _id: 0, id: 1 } },
      ),
      db
        .collection<{
          _id: string;
          delivery_fee_cents?: number;
          free_delivery_threshold_cents?: number;
          points_per_dollar?: number;
          points_per_dollar_redeemed?: number;
        }>("site_settings")
        .findOne({ _id: "storefront" }),
      data.promoCode
        ? db
            .collection<StoredPromotion>("promotions")
            .findOne({ code: data.promoCode.trim().toUpperCase() })
        : Promise.resolve(null),
    ]);
    if (!store) return { ok: false as const, error: "Please choose a store." };

    const linkedIds = [
      ...new Set(
        items.flatMap((item) => [
          ...(item.bundle_components ?? []).flatMap((component) =>
            component.menu_item_id ? [component.menu_item_id] : [],
          ),
          ...item.options.flatMap((group) =>
            group.choices.flatMap((choice) => (choice.menu_item_id ? [choice.menu_item_id] : [])),
          ),
        ]),
      ),
    ];
    const linkedItems = linkedIds.length
      ? await collection<MenuItem>(db, "menu_items")
          .find({ id: { $in: linkedIds } })
          .project<MenuItem>({ _id: 0 })
          .toArray()
      : [];
    const byId = new Map([...items, ...linkedItems].map((i) => [i.id, i]));
    const snapshots: OrderLineSnapshot[] = [];
    const priced: { category: CategoryId; lineTotalCents: number }[] = [];
    try {
      for (const line of data.lines) {
        const item = byId.get(line.itemId);
        if (!item)
          return { ok: false as const, error: "An item in your bag is no longer on the menu." };
        if (!item.is_available)
          return { ok: false as const, error: `${item.name} is sold out right now.` };
        validateMenuBundle(item, line.selections, byId);
        const options = item.options;
        const removed = line.removed.filter((r) => item.ingredients.includes(r));
        const unit = unitPriceCents({ price_cents: item.price_cents, options }, line.selections);
        snapshots.push({
          itemId: item.id,
          slug: item.slug,
          name: item.name,
          imageKey: item.image_key,
          quantity: line.quantity,
          unitPriceCents: unit,
          summary: selectionSummary({ options }, line.selections, removed),
          selections: line.selections,
          removed,
          note: line.note,
          bundleComponents: bundleComponentsFor(item, line.selections),
        });
        priced.push({
          category: item.category,
          lineTotalCents: unit * line.quantity,
        });
      }

      const session = client.startSession();
      let orderNumber = 0;
      let orderId = "";
      let pointsEarned = 0;
      try {
        await session.withTransaction(async () => {
          const guests = collection<GuestDocument>(db, "guests");
          const guest = await guests.findOne({ id: data.guestId }, { session });
          if (storedPromotion && !storedPromotion.active) {
            throw new PricingError("That promo code is no longer active.");
          }
          const databasePromotion: PromoDefinition | null = storedPromotion
            ? {
                code: storedPromotion.code,
                label: storedPromotion.label,
                description: storedPromotion.description,
                kind: storedPromotion.kind,
                value: storedPromotion.value,
                ...(storedPromotion.minSubtotalCents !== undefined
                  ? { minSubtotalCents: storedPromotion.minSubtotalCents }
                  : {}),
                ...(storedPromotion.category ? { category: storedPromotion.category } : {}),
              }
            : null;
          if (
            storedPromotion?.usage_limit !== undefined &&
            (storedPromotion.usage_count ?? 0) >= storedPromotion.usage_limit
          ) {
            throw new PricingError("That promo code has reached its usage limit.");
          }
          const totals = computeTotals({
            lines: priced,
            fulfillment: data.fulfillment,
            promoCode: data.promoCode,
            pointsToRedeem: data.pointsToRedeem,
            availablePoints: guest?.points ?? 0,
            promotions: databasePromotion
              ? [
                  ...PROMOS.filter((promo) => promo.code !== databasePromotion.code),
                  databasePromotion,
                ]
              : PROMOS,
            deliveryFeeCents: settings?.delivery_fee_cents ?? DELIVERY_FEE_CENTS,
            freeDeliveryThresholdCents:
              settings?.free_delivery_threshold_cents ?? FREE_DELIVERY_THRESHOLD_CENTS,
            pointsPerDollar: settings?.points_per_dollar,
            pointsPerDollarRedeemed: settings?.points_per_dollar_redeemed,
          });
          if (storedPromotion) {
            const promotionUpdate = await db.collection("promotions").updateOne(
              {
                id: storedPromotion.id,
                active: true,
                $expr: {
                  $or: [
                    { $eq: [{ $type: "$usage_limit" }, "missing"] },
                    { $lt: [{ $ifNull: ["$usage_count", 0] }, "$usage_limit"] },
                  ],
                },
              },
              { $inc: { usage_count: 1 } },
              { session },
            );
            if (!promotionUpdate.modifiedCount) {
              throw new PricingError("That promo code has reached its usage limit.");
            }
          }
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
            receipt_number: `GS-${String(counter.sequence + 1000).padStart(6, "0")}`,
            checkout_request_id: requestId,
            guest_id: data.guestId,
            status: "received",
            status_history: [{ status: "received", updated_at: now }],
            fulfillment: data.fulfillment,
            store_id: data.storeId,
            address: data.fulfillment === "delivery" ? data.address : null,
            items: snapshots,
            currency: "USD",
            subtotal_cents: totals.subtotalCents,
            discount_cents: totals.discountCents,
            promo_code: totals.promoCode,
            points_redeemed: totals.pointsRedeemed,
            delivery_fee_cents: totals.deliveryFeeCents,
            tax_cents: totals.taxCents,
            total_cents: totals.totalCents,
            points_earned: totals.pointsEarned,
            payment_last4: data.paymentLast4,
            payment_method: "Demo card",
            payment_status: "not_charged",
            customer_name: data.fulfillment === "delivery" ? data.address!.name : data.pickupName!,
            customer_phone: data.fulfillment === "delivery" ? data.address!.phone : null,
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
          await collection<UserDocument>(db, "users").updateOne(
            { id: data.guestId },
            {
              $set: {
                is_guest: true,
                display_name: order.customer_name,
                ...(data.fulfillment === "delivery" ? { phone: data.address!.phone } : {}),
                updated_at: now,
              },
              $setOnInsert: {
                created_at: now,
                ...(data.fulfillment === "pickup" ? { phone: null } : {}),
              },
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
        receiptNumber: `GS-${String(orderNumber).padStart(6, "0")}`,
        accessToken: (await import("./order-access.server")).createOrderAccessToken(
          orderId,
          data.guestId,
        ),
        pointsEarned,
      };
    } catch (e) {
      if (e instanceof PricingError) return { ok: false as const, error: e.message };
      if ((e as { code?: number }).code === 11000 && data.requestId) {
        const duplicate = await collection<OrderDocument>(db, "orders").findOne(
          { guest_id: data.guestId, checkout_request_id: requestId },
          { projection: { _id: 0, id: 1, order_number: 1, points_earned: 1, receipt_number: 1 } },
        );
        if (duplicate) {
          const { createOrderAccessToken } = await import("./order-access.server");
          return {
            ok: true as const,
            orderId: duplicate.id,
            orderNumber: duplicate.order_number,
            receiptNumber:
              duplicate.receipt_number ?? `GS-${String(duplicate.order_number).padStart(6, "0")}`,
            accessToken: createOrderAccessToken(duplicate.id, data.guestId),
            pointsEarned: duplicate.points_earned,
          };
        }
      }
      throw e;
    }
  });

export const getGuestRewards = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ guestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const [guest, orders] = await Promise.all([
      collection<GuestDocument>(db, "guests").findOne(
        { id: data.guestId },
        { projection: { _id: 0, points: 1, lifetime_points: 1, created_at: 1 } },
      ),
      collection<OrderDocument>(db, "orders")
        .find({
          guest_id: data.guestId,
          $or: [
            { payment_status: { $exists: false } },
            { payment_status: { $in: ["not_charged", "paid"] } },
          ],
        })
        .project<
          Pick<
            OrderDocument,
            | "id"
            | "order_number"
            | "receipt_number"
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
    const { createOrderAccessToken } = await import("./order-access.server");
    return {
      points: guest?.points ?? 0,
      lifetimePoints: guest?.lifetime_points ?? 0,
      orders: orders.map((order) => ({
        ...order,
        receipt_number: order.receipt_number ?? `GS-${String(order.order_number).padStart(6, "0")}`,
        accessToken: createOrderAccessToken(order.id, data.guestId),
      })),
    };
  });

/** A signed bearer token grants read-only access to this order's tracking and receipt data. */
export const getOrder = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const order = await collection<OrderDocument>(db, "orders")
      .find({ id: data.id })
      .project<OrderDocument>({ _id: 0 })
      .next();
    if (!order) return null;
    const { verifyOrderAccessToken } = await import("./order-access.server");
    if (!verifyOrderAccessToken(data.token, order.id, order.guest_id)) return null;
    if (!order.receipt_number) {
      order.receipt_number = `GS-${String(order.order_number).padStart(6, "0")}`;
      await collection<OrderDocument>(db, "orders").updateOne(
        { id: order.id, receipt_number: { $exists: false } },
        { $set: { receipt_number: order.receipt_number } },
      );
    }
    const store = await collection<Store>(db, "stores")
      .find({ id: order.store_id })
      .project<Pick<Store, "name" | "address" | "city" | "state" | "phone">>({
        _id: 0,
        name: 1,
        address: 1,
        city: 1,
        state: 1,
        phone: 1,
      })
      .next();
    const stores = store
      ? {
          name: store.name,
          address: store.address,
          city: store.city,
          state: store.state,
          phone: store.phone,
        }
      : null;
    return {
      ...order,
      payment_status: order.payment_status ?? "not_charged",
      status_history: order.status_history ?? [
        { status: order.status, updated_at: order.updated_at },
      ],
      stores,
    };
  });
