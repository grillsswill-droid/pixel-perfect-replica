import { MongoClient, ObjectId, type Db, type Document } from "mongodb";

import type { MenuItem, OrderLineSnapshot, Store } from "./menu-types";
import type { OrderStatus } from "./order-status";

export interface GuestDocument {
  id: string;
  points: number;
  lifetime_points: number;
  created_at: string;
}

export interface OrderAddress {
  name: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  instructions: string;
}

export interface OrderDocument {
  id: string;
  order_number: number;
  guest_id: string;
  status: OrderStatus;
  fulfillment: "delivery" | "pickup";
  store_id: string;
  address: OrderAddress | null;
  items: OrderLineSnapshot[];
  subtotal_cents: number;
  discount_cents: number;
  promo_code: string | null;
  points_redeemed: number;
  delivery_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  points_earned: number;
  payment_last4: string;
  customer_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminLogDocument {
  id: string;
  admin_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CounterDocument {
  _id: string;
  sequence: number;
}

type MongoDocument<T> = T &
  Document & {
    _id?: T extends { _id: infer Id } ? Id : ObjectId;
  };

const globalMongo = globalThis as typeof globalThis & {
  __grillSwillMongoClient?: MongoClient;
};
const indexSetupByDb = new WeakMap<Db, Promise<void>>();

function getClient(): MongoClient {
  const uri = process.env["MONGODB_URI"]?.trim();
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Configure a MongoDB connection string in the server environment.",
    );
  }

  if (!globalMongo.__grillSwillMongoClient) {
    globalMongo.__grillSwillMongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }
  return globalMongo.__grillSwillMongoClient;
}

async function ensureIndexes(db: Db): Promise<void> {
  let setup = indexSetupByDb.get(db);
  if (!setup) {
    setup = Promise.all([
      db.collection<MongoDocument<MenuItem>>("menu_items").createIndex({ id: 1 }, { unique: true }),
      db
        .collection<MongoDocument<MenuItem>>("menu_items")
        .createIndex({ slug: 1 }, { unique: true }),
      db
        .collection<MongoDocument<MenuItem>>("menu_items")
        .createIndex({ category: 1, sort_order: 1 }),
      db.collection<MongoDocument<Store>>("stores").createIndex({ id: 1 }, { unique: true }),
      db.collection<MongoDocument<Store>>("stores").createIndex({ sort_order: 1 }),
      db
        .collection<MongoDocument<GuestDocument>>("guests")
        .createIndex({ id: 1 }, { unique: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ id: 1 }, { unique: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ order_number: 1 }, { unique: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ guest_id: 1, created_at: -1 }),
      db.collection<MongoDocument<OrderDocument>>("orders").createIndex({ created_at: -1 }),
      db.collection<MongoDocument<AdminLogDocument>>("admin_logs").createIndex({ created_at: -1 }),
    ]).then(() => undefined);
    indexSetupByDb.set(db, setup);
  }
  await setup;
}

export async function getMongoDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const client = getClient();
  await client.connect();
  const databaseName = process.env["MONGODB_DATABASE"]?.trim();
  const db = databaseName ? client.db(databaseName) : client.db();
  await ensureIndexes(db);
  return { client, db };
}

export function collection<T>(db: Db, name: string) {
  return db.collection<MongoDocument<T>>(name);
}
