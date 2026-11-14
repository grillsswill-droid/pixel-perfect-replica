import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrderLineSnapshot } from "./menu-types";

async function assertAdmin(supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: kitchen staff only");
}

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error("Couldn't claim admin access.");
    return { granted: Boolean(data) };
  });

export const getAdminBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { isAdmin: false as const };
    const [orders, menu, logs] = await Promise.all([
      context.supabase
        .from("orders")
        .select("id, order_number, status, fulfillment, items, total_cents, customer_name, created_at, updated_at, address, stores(name)")
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase.from("menu_items").select("id, name, category, is_available, price_cents").order("category").order("sort_order"),
      context.supabase.from("admin_logs").select("id, action, details, created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    return {
      isAdmin: true as const,
      orders: (orders.data ?? []).map((o) => ({ ...o, items: o.items as unknown as OrderLineSnapshot[] })),
      menu: menu.data ?? [],
      logs: logs.data ?? [],
    };
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["received", "kitchen", "handoff", "completed", "cancelled"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Couldn't update the order.");
    await context.supabase
      .from("admin_logs")
      .insert({ admin_id: context.userId, action: "order_status", details: { order_id: data.id, status: data.status } });
    return { ok: true };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), available: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("menu_items").update({ is_available: data.available }).eq("id", data.id);
    if (error) throw new Error("Couldn't update the item.");
    await context.supabase
      .from("admin_logs")
      .insert({ admin_id: context.userId, action: "inventory", details: { item_id: data.id, available: data.available } });
    return { ok: true };
  });
