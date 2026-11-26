import type { Db } from "mongodb";

import type { Fulfillment, Store } from "./menu-types";
import { collection } from "./mongodb.server";

export class OrderLocationError extends Error {}

/** Delivery needs no store when the administrator has not configured any. */
export async function resolveOrderStoreId(
  db: Db,
  { fulfillment, storeId }: { fulfillment: Fulfillment; storeId: string | null },
): Promise<string | null> {
  const store = await collection<Store>(db, "stores").findOne(storeId ? { id: storeId } : {}, {
    projection: { _id: 0, id: 1 },
  });
  if (storeId) {
    if (!store)
      throw new OrderLocationError("Your selection changed. Review checkout and try again.");
    return store.id;
  }
  if (fulfillment === "pickup") {
    throw new OrderLocationError("Pickup is unavailable. Choose delivery.");
  }
  if (store) throw new OrderLocationError("Please choose a location before continuing.");
  return null;
}
