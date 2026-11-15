import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import { defaultCategories, defaultMenu, defaultStores } from "./default-catalog";
import type { MenuCategory, MenuItem, Store } from "./menu-types";

function getFallbackCategories(): MenuCategory[] {
  return defaultCategories;
}

function getFallbackMenu(): MenuItem[] {
  return defaultMenu;
}

function getFallbackStores(): Store[] {
  return defaultStores;
}

export const getCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<MenuCategory[]> => {
    try {
      const { collection, getMongoDatabase } = await import("./mongodb.server");
      const { db } = await getMongoDatabase();
      const categories = await collection<MenuCategory>(db, "categories")
        .find({})
        .project<MenuCategory>({ _id: 0 })
        .sort({ sort_order: 1 })
        .toArray();
      return categories.length ? categories : getFallbackCategories();
    } catch {
      return getFallbackCategories();
    }
  },
);

export const getMenu = createServerFn({ method: "GET" }).handler(async (): Promise<MenuItem[]> => {
  try {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const menu = await collection<MenuItem>(db, "menu_items")
      .find({})
      .project<MenuItem>({ _id: 0 })
      .sort({ category: 1, sort_order: 1 })
      .toArray();
    return menu.length ? menu : getFallbackMenu();
  } catch {
    return getFallbackMenu();
  }
});

export const getStores = createServerFn({ method: "GET" }).handler(async (): Promise<Store[]> => {
  try {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const stores = await collection<Store>(db, "stores")
      .find({})
      .project<Store>({ _id: 0 })
      .sort({ sort_order: 1 })
      .toArray();
    return stores.length ? stores : getFallbackStores();
  } catch {
    return getFallbackStores();
  }
});

export const menuQuery = () =>
  queryOptions({ queryKey: ["menu"], queryFn: () => getMenu(), staleTime: 30_000 });
export const categoriesQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => getCategories(), staleTime: 5 * 60_000 });
export const storesQuery = () =>
  queryOptions({ queryKey: ["stores"], queryFn: () => getStores(), staleTime: 5 * 60_000 });
