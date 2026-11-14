import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";

import type { Database } from "@/integrations/supabase/types";
import type { MenuItem, OptionGroup, Store } from "./menu-types";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getMenu = createServerFn({ method: "GET" }).handler(async (): Promise<MenuItem[]> => {
  const { data, error } = await publicClient()
    .from("menu_items")
    .select("*")
    .order("category")
    .order("sort_order");
  if (error) {
    console.error("getMenu", error);
    throw new Error("The menu couldn't be loaded right now.");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    category: r.category as MenuItem["category"],
    name: r.name,
    description: r.description,
    price_cents: r.price_cents,
    calories: r.calories,
    image_key: r.image_key,
    tags: r.tags,
    ingredients: r.ingredients,
    options: r.options as unknown as OptionGroup[],
    is_available: r.is_available,
    is_featured: r.is_featured,
    sort_order: r.sort_order,
  }));
});

export const getStores = createServerFn({ method: "GET" }).handler(async (): Promise<Store[]> => {
  const { data, error } = await publicClient().from("stores").select("*").order("sort_order");
  if (error) {
    console.error("getStores", error);
    throw new Error("Store locations couldn't be loaded right now.");
  }
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    phone: s.phone,
    lat: s.lat,
    lng: s.lng,
    hours: s.hours,
    features: s.features,
  }));
});

export const menuQuery = () => queryOptions({ queryKey: ["menu"], queryFn: () => getMenu(), staleTime: 30_000 });
export const storesQuery = () =>
  queryOptions({ queryKey: ["stores"], queryFn: () => getStores(), staleTime: 5 * 60_000 });
