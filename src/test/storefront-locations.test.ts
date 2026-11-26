import type { Db } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: (...args: unknown[]) => unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/lib/mongodb.server", () => ({
  getMongoDatabase: mocks.database,
  collection: (db: Db, name: string) => db.collection(name),
}));

import { getStores } from "@/lib/catalog.functions";
import type { Store } from "@/lib/menu-types";
import { OrderLocationError, resolveOrderStoreId } from "@/lib/storefront-locations.server";

const store: Store = {
  id: "00000000-0000-4000-8000-000000000012",
  name: "Configured grill",
  address: "123 Test Street",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "5125550100",
  lat: 0,
  lng: 0,
  hours: "Daily 10am–8pm",
  features: [],
};

function databaseWith(stores: Store[]) {
  const cursor = {
    project: () => cursor,
    sort: () => cursor,
    toArray: async () => stores,
  };
  return {
    collection: () => ({
      find: () => cursor,
      findOne: async (filter: { id?: string }) =>
        stores.find((entry) => !filter.id || entry.id === filter.id) ?? null,
    }),
  } as unknown as Db;
}

beforeEach(() => {
  mocks.database.mockReset();
});

describe("Administrator-configured storefront locations", () => {
  it("returns no sample locations when the admin list is empty", async () => {
    mocks.database.mockResolvedValue({ db: databaseWith([]) });
    await expect(getStores()).resolves.toEqual([]);
  });

  it("returns no sample locations when the database is unavailable", async () => {
    mocks.database.mockRejectedValue(new Error("Synthetic database outage"));
    await expect(getStores()).resolves.toEqual([]);
  });

  it("returns only the configured locations", async () => {
    mocks.database.mockResolvedValue({ db: databaseWith([store]) });
    await expect(getStores()).resolves.toEqual([store]);
  });

  it("allows delivery without a store only when no locations exist", async () => {
    await expect(
      resolveOrderStoreId(databaseWith([]), {
        fulfillment: "delivery",
        storeId: null,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveOrderStoreId(databaseWith([store]), {
        fulfillment: "delivery",
        storeId: null,
      }),
    ).rejects.toBeInstanceOf(OrderLocationError);
  });

  it("requires an existing location for pickup", async () => {
    await expect(
      resolveOrderStoreId(databaseWith([]), {
        fulfillment: "pickup",
        storeId: null,
      }),
    ).rejects.toBeInstanceOf(OrderLocationError);
    await expect(
      resolveOrderStoreId(databaseWith([]), {
        fulfillment: "pickup",
        storeId: store.id,
      }),
    ).rejects.toBeInstanceOf(OrderLocationError);
    await expect(
      resolveOrderStoreId(databaseWith([store]), {
        fulfillment: "pickup",
        storeId: store.id,
      }),
    ).resolves.toBe(store.id);
  });
});
