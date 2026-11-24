import { existsSync } from "node:fs";
import { MongoClient, ObjectId, type Db, type Document } from "mongodb";

import type {
  CartLine,
  Fulfillment,
  MenuCategory,
  MenuItem,
  OrderLineSnapshot,
  Store,
} from "./menu-types";
import type { OrderStatus } from "./order-status";

export type PaymentProvider = "stripe" | "paypal" | "flutterwave";
export type PaymentStatus =
  | "not_charged"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded";
export type CommerceEffectsStatus = "reserved" | "applied" | "released";

export interface GuestDocument {
  id: string;
  points: number;
  lifetime_points: number;
  created_at: string;
}

export interface UserDocument {
  id: string;
  is_guest: true;
  display_name: string;
  phone: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartDocument {
  id: string;
  lines: CartLine[];
  fulfillment: Fulfillment;
  store_id: string | null;
  updated_at: string;
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
  receipt_number?: string;
  checkout_request_id?: string;
  guest_id: string;
  status: OrderStatus;
  status_history?: { status: OrderStatus; updated_at: string }[];
  fulfillment: "delivery" | "pickup";
  store_id: string;
  address: OrderAddress | null;
  items: OrderLineSnapshot[];
  currency: "USD";
  subtotal_cents: number;
  discount_cents: number;
  promo_code: string | null;
  points_redeemed: number;
  delivery_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  points_earned: number;
  payment_last4?: string;
  payment_method?: string;
  payment_provider?: PaymentProvider;
  payment_status?: PaymentStatus;
  payment_reference?: string;
  payment_transaction_id?: string;
  payment_checkout_url?: string;
  payment_expires_at?: string;
  payment_amount_cents?: number;
  payment_currency?: "USD";
  payment_refunded_cents?: number;
  payment_failure_code?: string;
  payment_updated_at?: string;
  commerce_effects_status?: CommerceEffectsStatus;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLogDocument {
  id: string;
  admin_id: string | null;
  action: string;
  details: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface PaymentEventDocument {
  id: string;
  provider: PaymentProvider;
  provider_event_id: string;
  type: string;
  order_id?: string;
  status: "processing" | "processed" | "failed";
  attempts: number;
  livemode?: boolean;
  error_code?: string;
  created_at: string;
  processed_at?: string;
  updated_at: string;
}

export interface GalleryLikeDocument {
  id: string;
  gallery_item_id: string;
  visitor_hash: string;
  created_at: string;
}

export interface GalleryCommentDocument {
  id: string;
  gallery_item_id: string;
  guest_id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface CateringInquiryDocument {
  id: string;
  guest_id: string;
  name: string;
  email: string;
  phone: string;
  event_date: string;
  guest_count: number;
  package_id: string | null;
  package_name: string | null;
  message: string;
  status: "new" | "contacted" | "closed";
  created_at: string;
  updated_at: string;
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
  __grillSwillMongoDatabase?: Promise<{ client: MongoClient; db: Db }>;
};
const indexSetupByDb = new WeakMap<Db, Promise<void>>();

export function requireMongoUri(uri: string | undefined): string {
  const normalized = uri?.trim();
  if (!normalized) {
    throw new Error(
      "Missing MONGODB_URI. Configure a MongoDB connection string in the server environment.",
    );
  }
  return normalized;
}

function loadLocalEnvironment(): void {
  for (const path of [".env.local", ".env"]) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

function getClient(): MongoClient {
  if (!process.env["MONGODB_URI"]?.trim()) loadLocalEnvironment();
  const uri = requireMongoUri(process.env["MONGODB_URI"]);

  if (!globalMongo.__grillSwillMongoClient) {
    globalMongo.__grillSwillMongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      maxIdleTimeMS: 60_000,
      // Atlas DNS/TLS negotiation can exceed five seconds on a cold process.
      // Allow the initial connection to settle instead of failing optional cart sync.
      connectTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
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
        .collection<MongoDocument<MenuCategory>>("categories")
        .createIndex({ id: 1 }, { unique: true }),
      db.collection<MongoDocument<MenuCategory>>("categories").createIndex({ sort_order: 1 }),
      db.collection<MongoDocument<CartDocument>>("carts").createIndex({ id: 1 }, { unique: true }),
      db.collection<MongoDocument<CartDocument>>("carts").createIndex({ updated_at: -1 }),
      db.collection<MongoDocument<UserDocument>>("users").createIndex({ id: 1 }, { unique: true }),
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
        .createIndex({ receipt_number: 1 }, { unique: true, sparse: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ guest_id: 1, checkout_request_id: 1 }, { unique: true, sparse: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ guest_id: 1, created_at: -1 }),
      db.collection<MongoDocument<OrderDocument>>("orders").createIndex({ created_at: -1 }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ payment_provider: 1, payment_reference: 1 }, { sparse: true }),
      db
        .collection<MongoDocument<OrderDocument>>("orders")
        .createIndex({ payment_transaction_id: 1 }, { sparse: true }),
      db.collection<MongoDocument<AdminLogDocument>>("admin_logs").createIndex({ created_at: -1 }),
      db
        .collection<MongoDocument<PaymentEventDocument>>("payment_events")
        .createIndex({ provider: 1, provider_event_id: 1 }, { unique: true }),
      db
        .collection<MongoDocument<PaymentEventDocument>>("payment_events")
        .createIndex({ created_at: -1 }),
      db
        .collection<MongoDocument<GalleryLikeDocument>>("gallery_likes")
        .createIndex({ gallery_item_id: 1, visitor_hash: 1 }, { unique: true }),
      db
        .collection<MongoDocument<GalleryCommentDocument>>("gallery_comments")
        .createIndex({ gallery_item_id: 1, created_at: 1 }),
      db
        .collection<MongoDocument<GalleryCommentDocument>>("gallery_comments")
        .createIndex({ guest_id: 1, created_at: -1 }),
      db
        .collection<MongoDocument<CateringInquiryDocument>>("catering_inquiries")
        .createIndex({ id: 1 }, { unique: true }),
      db
        .collection<MongoDocument<CateringInquiryDocument>>("catering_inquiries")
        .createIndex({ created_at: -1 }),
      db
        .collection<MongoDocument<CateringInquiryDocument>>("catering_inquiries")
        .createIndex({ guest_id: 1, created_at: -1 }),
      db.collection("promotions").createIndex({ code: 1 }, { unique: true, sparse: true }),
      db.collection("catering_packages").createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection("catering_proteins").createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection("gallery_items").createIndex({ id: 1 }, { unique: true, sparse: true }),
    ]).then(() => undefined);
    indexSetupByDb.set(db, setup);
  }
  await setup;
}

export async function getMongoDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!globalMongo.__grillSwillMongoDatabase) {
    const connection = (async () => {
      const client = getClient();
      await client.connect();
      const databaseName = process.env["MONGODB_DATABASE"]?.trim();
      const db = databaseName ? client.db(databaseName) : client.db();
      await ensureIndexes(db);
      return { client, db };
    })();

    globalMongo.__grillSwillMongoDatabase = connection;
    void connection.catch(() => {
      if (globalMongo.__grillSwillMongoDatabase === connection) {
        globalMongo.__grillSwillMongoDatabase = undefined;
      }
    });
  }

  return globalMongo.__grillSwillMongoDatabase;
}

export function collection<T>(db: Db, name: string) {
  return db.collection<MongoDocument<T>>(name);
}
