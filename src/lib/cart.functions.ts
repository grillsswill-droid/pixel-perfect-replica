import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CartDocument } from "./mongodb.server";

const selectionsSchema = z.record(z.array(z.string().max(40)).max(10));

const cartLineSchema = z.object({
  key: z.string().max(500),
  itemId: z.string().uuid(),
  slug: z.string().max(100),
  category: z.enum(["burgers", "chicken", "pizza", "sides", "drinks", "kids", "desserts"]),
  name: z.string().max(120),
  imageKey: z.string().max(100),
  quantity: z.number().int().min(1).max(20),
  selections: selectionsSchema,
  removed: z.array(z.string().max(60)).max(20),
  note: z.string().max(140),
  unitPriceCents: z.number().int().min(0).max(100_000),
  summary: z.array(z.string().max(120)).max(40),
  bundleComponents: z
    .array(
      z.object({
        label: z.string().max(120),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(30)
    .optional(),
});

export const saveCartSchema = z.object({
  guestId: z.string().uuid(),
  lines: z.array(cartLineSchema).max(40),
  fulfillment: z.enum(["delivery", "pickup"]),
  storeId: z.string().uuid().nullable(),
});

export const getCart = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ guestId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const cart = await collection<CartDocument>(db, "carts").findOne(
      { id: data.guestId },
      { projection: { _id: 0, lines: 1, fulfillment: 1, store_id: 1 } },
    );
    if (!cart) return null;
    return {
      lines: cart.lines,
      fulfillment: cart.fulfillment,
      storeId: cart.store_id,
    };
  });

export const saveCart = createServerFn({ method: "POST" })
  .validator((data: unknown) => saveCartSchema.parse(data))
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const now = new Date().toISOString();
    const cart: CartDocument = {
      id: data.guestId,
      lines: data.lines.map((line) => ({
        key: line.key,
        itemId: line.itemId,
        slug: line.slug,
        category: line.category,
        name: line.name,
        imageKey: line.imageKey,
        quantity: line.quantity,
        selections: line.selections,
        removed: line.removed,
        note: line.note,
        unitPriceCents: line.unitPriceCents,
        summary: line.summary,
        ...(line.bundleComponents ? { bundleComponents: line.bundleComponents } : {}),
      })),
      fulfillment: data.fulfillment,
      store_id: data.storeId,
      updated_at: now,
    };
    await collection<CartDocument>(db, "carts").updateOne(
      { id: data.guestId },
      { $set: cart },
      { upsert: true },
    );
    return { ok: true as const };
  });
