import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import type { CategoryId, OptionGroup, OrderLineSnapshot } from "./menu-types";
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
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  phone: z.string().trim().regex(/^[\d\s()+.-]{10,20}$/, "Enter a valid phone number"),
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
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A delivery address is required", path: ["address"] });
    }
    if (v.fulfillment === "pickup" && (!v.pickupName || v.pickupName.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add a name for pickup", path: ["pickupName"] });
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = [...new Set(data.lines.map((l) => l.itemId))];
    const [{ data: items, error: itemsErr }, { data: store }, { data: guest }] = await Promise.all([
      supabaseAdmin.from("menu_items").select("*").in("id", ids),
      supabaseAdmin.from("stores").select("id").eq("id", data.storeId).maybeSingle(),
      supabaseAdmin.from("guests").select("points, lifetime_points").eq("id", data.guestId).maybeSingle(),
    ]);
    if (itemsErr) {
      console.error("placeOrder menu", itemsErr);
      return { ok: false as const, error: "Couldn't check the menu. Please try again." };
    }
    if (!store) return { ok: false as const, error: "Please choose a store." };

    const byId = new Map((items ?? []).map((i) => [i.id, i]));
    const snapshots: OrderLineSnapshot[] = [];
    const priced: { category: CategoryId; lineTotalCents: number }[] = [];
    try {
      for (const line of data.lines) {
        const item = byId.get(line.itemId);
        if (!item) return { ok: false as const, error: "An item in your bag is no longer on the menu." };
        if (!item.is_available) return { ok: false as const, error: `${item.name} is sold out right now.` };
        const options = item.options as unknown as OptionGroup[];
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
        priced.push({ category: item.category as CategoryId, lineTotalCents: unit * line.quantity });
      }

      const available = guest?.points ?? 0;
      const totals = computeTotals({
        lines: priced,
        fulfillment: data.fulfillment,
        promoCode: data.promoCode,
        pointsToRedeem: data.pointsToRedeem,
        availablePoints: available,
      });

      const { data: order, error: insertErr } = await supabaseAdmin
        .from("orders")
        .insert({
          guest_id: data.guestId,
          fulfillment: data.fulfillment,
          store_id: data.storeId,
          address: (data.fulfillment === "delivery" ? data.address : null) as unknown as Json,
          items: snapshots as unknown as Json,
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
        })
        .select("id, order_number")
        .single();
      if (insertErr || !order) {
        console.error("placeOrder insert", insertErr);
        return { ok: false as const, error: "We couldn't place your order. You weren't charged." };
      }

      await supabaseAdmin.from("guests").upsert({
        id: data.guestId,
        points: available - totals.pointsRedeemed + totals.pointsEarned,
        lifetime_points: (guest?.lifetime_points ?? 0) + totals.pointsEarned,
      });

      return {
        ok: true as const,
        orderId: order.id,
        orderNumber: order.order_number,
        pointsEarned: totals.pointsEarned,
      };
    } catch (e) {
      if (e instanceof PricingError) return { ok: false as const, error: e.message };
      throw e;
    }
  });

export const getGuestRewards = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ guestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: guest }, { data: orders }] = await Promise.all([
      supabaseAdmin.from("guests").select("points, lifetime_points, created_at").eq("id", data.guestId).maybeSingle(),
      supabaseAdmin
        .from("orders")
        .select(
          "id, order_number, status, fulfillment, store_id, items, total_cents, points_earned, created_at",
        )
        .eq("guest_id", data.guestId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    return {
      points: guest?.points ?? 0,
      lifetimePoints: guest?.lifetime_points ?? 0,
      orders: (orders ?? []).map((o) => ({ ...o, items: o.items as unknown as OrderLineSnapshot[] })),
    };
  });

/** Order IDs are unguessable; the tracking link works like a receipt. */
export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, fulfillment, address, items, subtotal_cents, discount_cents, promo_code, points_redeemed, delivery_fee_cents, tax_cents, total_cents, points_earned, payment_last4, customer_name, created_at, updated_at, stores(name, address, city, state, phone)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!order) return null;
    return {
      ...order,
      address: order.address as unknown as DeliveryAddress | null,
      items: order.items as unknown as OrderLineSnapshot[],
    };
  });
