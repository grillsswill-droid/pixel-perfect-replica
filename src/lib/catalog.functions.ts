import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { defaultCategories, defaultMenu, defaultStores } from "./default-catalog";
import type { MenuCategory, MenuItem, Store } from "./menu-types";
import {
  PricingError,
  bundleComponentsFor,
  selectionSummary,
  unitPriceCents,
  validateMenuBundle,
  withMenuBundleAvailability,
} from "./pricing";

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
    return withMenuBundleAvailability(menu.length ? menu : getFallbackMenu());
  } catch (error) {
    console.error("Menu data unavailable; using the bundled catalog.", error);
    return withMenuBundleAvailability(getFallbackMenu());
  }
});

export const verifyQuickOrderSelection = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        selections: z.record(z.array(z.string().max(40)).max(10)),
      })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const item = await collection<MenuItem>(db, "menu_items").findOne(
      { id: data.itemId },
      { projection: { _id: 0 } },
    );
    if (!item || !item.is_quick_order) {
      return { ok: false as const, error: "This Quick Order item is no longer available." };
    }

    try {
      if (!item.is_available) throw new PricingError(`${item.name} is sold out right now.`);
      const linkedIds = [
        ...new Set([
          ...(item.bundle_components ?? []).flatMap((component) =>
            component.menu_item_id ? [component.menu_item_id] : [],
          ),
          ...item.options.flatMap((group) =>
            group.choices.flatMap((choice) => (choice.menu_item_id ? [choice.menu_item_id] : [])),
          ),
        ]),
      ];
      const linkedItems = linkedIds.length
        ? await collection<MenuItem>(db, "menu_items")
            .find({ id: { $in: linkedIds } })
            .project<MenuItem>({ _id: 0 })
            .toArray()
        : [];
      const itemsById = new Map([...linkedItems, item].map((entry) => [entry.id, entry]));
      validateMenuBundle(item, data.selections, itemsById);
      const unitPriceCentsValue = unitPriceCents(item, data.selections);
      return {
        ok: true as const,
        line: {
          itemId: item.id,
          slug: item.slug,
          category: item.category,
          name: item.name,
          imageKey: item.image_key,
          unitPriceCents: unitPriceCentsValue,
          summary: selectionSummary(item, data.selections, []),
          bundleComponents: bundleComponentsFor(item, data.selections),
        },
      };
    } catch (error) {
      if (error instanceof PricingError) return { ok: false as const, error: error.message };
      throw error;
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
