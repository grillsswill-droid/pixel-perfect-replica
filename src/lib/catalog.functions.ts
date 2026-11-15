import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import type { MenuItem, Store } from "./menu-types";

export const getMenu = createServerFn({ method: "GET" }).handler(async (): Promise<MenuItem[]> => {
  const { collection, getMongoDatabase } = await import("./mongodb.server");
  const { db } = await getMongoDatabase();
  return collection<MenuItem>(db, "menu_items")
    .find({})
    .project<MenuItem>({ _id: 0 })
    .sort({ category: 1, sort_order: 1 })
    .toArray();
});

export const getStores = createServerFn({ method: "GET" }).handler(async (): Promise<Store[]> => {
  const { collection, getMongoDatabase } = await import("./mongodb.server");
  const { db } = await getMongoDatabase();
  return collection<Store>(db, "stores")
    .find({})
    .project<Store>({ _id: 0 })
    .sort({ sort_order: 1 })
    .toArray();
});

export const menuQuery = () =>
  queryOptions({ queryKey: ["menu"], queryFn: () => getMenu(), staleTime: 30_000 });
export const storesQuery = () =>
  queryOptions({ queryKey: ["stores"], queryFn: () => getStores(), staleTime: 5 * 60_000 });
