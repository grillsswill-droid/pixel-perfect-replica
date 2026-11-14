import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { DeliveryAddress } from "./orders.functions";
import type { OrderLineSnapshot } from "./menu-types";

type StaffSession = { staff?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "gs-staff",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

async function passcodeMatches(input: string, expected: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function isStaff(): Promise<boolean> {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<StaffSession>(sessionConfig());
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
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<StaffSession>(sessionConfig());
    await session.update({ staff: true });
    return { ok: true as const };
  });

export const lockKitchen = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<StaffSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const getKitchenBoard = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isStaff())) return { unlocked: false as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const [orders, menu, logs] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, order_number, status, fulfillment, items, total_cents, customer_name, created_at, updated_at, address, stores(name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin.from("menu_items").select("id, name, category, is_available, price_cents").order("category").order("sort_order"),
    supabaseAdmin.from("admin_logs").select("id, action, details, created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  return {
    unlocked: true as const,
    orders: (orders.data ?? []).map((o) => ({
      ...o,
      address: o.address as unknown as DeliveryAddress | null,
      items: o.items as unknown as OrderLineSnapshot[],
    })),
    menu: menu.data ?? [],
    logs: logs.data ?? [],
  };
});

export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["received", "kitchen", "handoff", "completed", "cancelled"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Couldn't update the order.");
    await supabaseAdmin.from("admin_logs").insert({ action: "order_status", details: { order_id: data.id, status: data.status } });
    return { ok: true };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), available: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_items").update({ is_available: data.available }).eq("id", data.id);
    if (error) throw new Error("Couldn't update the item.");
    await supabaseAdmin.from("admin_logs").insert({ action: "inventory", details: { item_id: data.id, available: data.available } });
    return { ok: true };
  });
