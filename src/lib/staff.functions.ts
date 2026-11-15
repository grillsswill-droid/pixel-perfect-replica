import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { DeliveryAddress } from "./orders.functions";
import type { MenuItem, OrderLineSnapshot, Store } from "./menu-types";
import type { AdminLogDocument, OrderDocument } from "./mongodb.server";
import { canTransitionOrder } from "./order-status";

type StaffSession = { staff?: boolean };

export function staffSessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }

  return {
    password,
    name: "gs-staff",
    maxAge: 60 * 60 * 12,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

async function passcodeMatches(input: string, expected: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function isStaff(): Promise<boolean> {
  const { useSession: getSession } = await import("@tanstack/react-start/server");
  const session = await getSession<StaffSession>(staffSessionConfig());
  return Boolean(session.data.staff);
}

async function requireStaff() {
  if (!(await isStaff())) throw new Error("Kitchen screen is locked");
}

export const unlockKitchen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ passcode: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["STAFF_PASSCODE"];
    if (!expected) throw new Error("Staff passcode isn't set up");
    if (!(await passcodeMatches(data.passcode, expected))) return { ok: false as const };
    const { useSession: getSession } = await import("@tanstack/react-start/server");
    const session = await getSession<StaffSession>(staffSessionConfig());
    await session.update({ staff: true });
    return { ok: true as const };
  });

export const lockKitchen = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession: getSession } = await import("@tanstack/react-start/server");
  const session = await getSession<StaffSession>(staffSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const getKitchenBoard = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isStaff())) return { unlocked: false as const };
  const { collection, getMongoDatabase } = await import("./mongodb.server");
  const { db } = await getMongoDatabase();
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const [orders, menu, logs] = await Promise.all([
    collection<OrderDocument>(db, "orders")
      .find({ created_at: { $gte: since } })
      .project<OrderDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .limit(80)
      .toArray(),
    collection<MenuItem>(db, "menu_items")
      .find({})
      .project<Pick<MenuItem, "id" | "name" | "category" | "is_available" | "price_cents">>({
        _id: 0,
        id: 1,
        name: 1,
        category: 1,
        is_available: 1,
        price_cents: 1,
      })
      .sort({ category: 1, sort_order: 1 })
      .toArray(),
    collection<AdminLogDocument>(db, "admin_logs")
      .find({})
      .project<AdminLogDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .limit(12)
      .toArray(),
  ]);
  const storeIds = [...new Set(orders.map((order) => order.store_id))];
  const stores = await collection<Store>(db, "stores")
    .find({ id: { $in: storeIds } })
    .project<Store>({ _id: 0 })
    .toArray();
  const storesById = new Map(stores.map((store) => [store.id, store]));

  return {
    unlocked: true as const,
    orders: orders.map((order) => ({
      ...order,
      stores: storesById.get(order.store_id) ?? null,
      address: order.address as DeliveryAddress | null,
      items: order.items as OrderLineSnapshot[],
    })),
    menu,
    logs,
  };
});

export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["received", "kitchen", "handoff", "completed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const orders = collection<OrderDocument>(db, "orders");
    const order = await orders.findOne({ id: data.id });
    if (!order) throw new Error("That order couldn't be found.");
    if (!canTransitionOrder(order.status, data.status)) {
      throw new Error(`Cannot move an order from ${order.status} to ${data.status}.`);
    }
    if (order.status === data.status) return { ok: true };
    const now = new Date().toISOString();
    const update = await orders.updateOne(
      { id: data.id, status: order.status },
      {
        $set: {
          status: data.status,
          updated_at: now,
          status_history: [
            ...(order.status_history ?? [{ status: order.status, updated_at: order.created_at }]),
            { status: data.status, updated_at: now },
          ],
        },
      },
    );
    if (update.modifiedCount === 0)
      throw new Error("The order changed in another session. Refresh and retry.");
    const { randomUUID } = await import("node:crypto");
    await collection<AdminLogDocument>(db, "admin_logs").insertOne({
      id: randomUUID(),
      admin_id: null,
      action: "order_status",
      details: { order_id: data.id, status: data.status },
      created_at: now,
    });
    return { ok: true };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), available: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const now = new Date().toISOString();
    const update = await collection<MenuItem>(db, "menu_items").updateOne(
      { id: data.id },
      { $set: { is_available: data.available, updated_at: now } },
    );
    if (update.matchedCount === 0) throw new Error("That menu item couldn't be found.");
    const { randomUUID } = await import("node:crypto");
    await collection<AdminLogDocument>(db, "admin_logs").insertOne({
      id: randomUUID(),
      admin_id: null,
      action: "inventory",
      details: { item_id: data.id, available: data.available },
      created_at: now,
    });
    return { ok: true };
  });
