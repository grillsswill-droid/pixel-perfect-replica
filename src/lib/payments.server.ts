import { randomUUID, timingSafeEqual } from "node:crypto";

import type { Db } from "mongodb";
import { z } from "zod";

import type { CategoryId, MenuItem, OrderLineSnapshot } from "./menu-types";
import type {
  AdminLogDocument,
  GuestDocument,
  OrderDocument,
  PaymentEventDocument,
  UserDocument,
} from "./mongodb.server";
import { collection, getMongoDatabase } from "./mongodb.server";
import { createOrderAccessToken } from "./order-access.server";
import { OrderLocationError, resolveOrderStoreId } from "./storefront-locations.server";
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  centsToDecimal,
  decimalToCents,
  normalizedCurrency,
  type ProviderCheckout,
  type ProviderPaymentOutcome,
} from "./payment-types";
import {
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  PROMOS,
  PricingError,
  bundleComponentsFor,
  computeTotals,
  selectionSummary,
  unitPriceCents,
  validateMenuBundle,
  type PromoDefinition,
} from "./pricing";

const FLUTTERWAVE_API_URL = "https://api.flutterwave.com/v3";
const FLUTTERWAVE_SECRET_KEY_PATTERN = /^FLWSECK(?:_TEST)?-[^\s"']+$/;
const FLUTTERWAVE_CHECKOUT_HOST = "checkout.flutterwave.com";
const FLUTTERWAVE_CHECKOUT_PATH_PREFIX = "/v3/hosted/pay/";
const FLUTTERWAVE_CHECKOUT_SESSION_MINUTES = 30;
const FLUTTERWAVE_INITIALIZATION_LOCK_MS = 60_000;
const PHONE_PATTERN = /^[\d\s()+.-]{10,20}$/;

const checkoutLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  selections: z.record(z.array(z.string().max(40)).max(10)),
  removed: z.array(z.string().max(60)).max(20),
  note: z.string().max(140),
});

const paymentAddressSchema = z.object({
  name: z.string().trim().min(2).max(80),
  street: z.string().trim().min(4).max(120),
  unit: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(2).max(60),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/),
  phone: z.string().trim().regex(PHONE_PATTERN),
  instructions: z.string().trim().max(200).optional().default(""),
});

const paymentAmountSchema = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "Amount must have no more than two decimal places.",
  );

/** JSON body accepted by POST /api/payments/initialize. */
export const initializeFlutterwavePaymentSchema = z
  .object({
    guestId: z.string().uuid(),
    requestId: z.string().uuid().optional(),
    lines: z.array(checkoutLineSchema).min(1, "Your bag is empty").max(40),
    fulfillment: z.enum(["delivery", "pickup"]),
    storeId: z.string().uuid().nullable().default(null),
    address: paymentAddressSchema.nullable(),
    promoCode: z.string().trim().max(20).optional().nullable(),
    pointsToRedeem: z.number().int().min(0).max(100_000),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    name: z.string().trim().min(2).max(80),
    phone_number: z.string().trim().regex(PHONE_PATTERN),
    amount: paymentAmountSchema,
    currency: z.literal("USD").default("USD"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fulfillment === "pickup" && !value.storeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a pickup location.",
        path: ["storeId"],
      });
    }
    if (value.fulfillment === "delivery" && !value.address) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A delivery address is required.",
        path: ["address"],
      });
    }
  });

export type InitializeFlutterwavePaymentInput = z.input<typeof initializeFlutterwavePaymentSchema>;
type ParsedInitializePaymentInput = z.output<typeof initializeFlutterwavePaymentSchema>;

type StorefrontPricingSettings = {
  _id: string;
  delivery_fee_cents?: number;
  free_delivery_threshold_cents?: number;
  points_per_dollar?: number;
  points_per_dollar_redeemed?: number;
};

type StoredPromotion = PromoDefinition & {
  id: string;
  usage_limit?: number;
  usage_count?: number;
  active: boolean;
};

type FlutterwaveEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
};

export type FlutterwaveTransaction = {
  id?: string | number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: string | number;
  charged_amount?: string | number;
  currency?: string;
  status?: string;
  payment_type?: string;
  customer?: {
    email?: string;
    name?: string;
    phone_number?: string;
  };
  meta?: {
    order_id?: string;
    order_number?: string | number;
  };
  card?: {
    last_4digits?: string;
  };
};

type PreparedOrder = {
  snapshots: OrderLineSnapshot[];
  pricedLines: { category: CategoryId; lineTotalCents: number }[];
  settings: StorefrontPricingSettings | null;
  storedPromotion: StoredPromotion | null;
};

export type InitializedFlutterwavePayment = {
  link: string;
  orderId: string;
  orderNumber: number;
  txRef: string;
  reused: boolean;
};

export type FlutterwaveVerificationResult =
  | {
      successful: true;
      orderId: string;
      orderNumber: number;
      accessToken: string;
      alreadyProcessed: boolean;
    }
  | {
      successful: false;
      status: "pending" | "cancelled" | "failed";
      orderId?: string;
    };

export class PaymentRequestError extends Error {
  override name = "PaymentRequestError";
}

export type PaymentProviderErrorCode =
  | "network_error"
  | "timeout"
  | "invalid_response"
  | "provider_rejected"
  | "missing_checkout_url"
  | "invalid_checkout_url"
  | "unexpected_checkout_url";

export class PaymentProviderError extends Error {
  override name = "PaymentProviderError";

  constructor(
    message: string,
    readonly code: PaymentProviderErrorCode = "provider_rejected",
  ) {
    super(message);
  }
}

export function isFlutterwaveConfigured(): boolean {
  const secretKey = process.env["FLW_SECRET_KEY"]?.trim();
  return Boolean(secretKey && FLUTTERWAVE_SECRET_KEY_PATTERN.test(secretKey));
}

function requireFlutterwaveSecretKey(): string {
  const secretKey = process.env["FLW_SECRET_KEY"]?.trim();
  if (!secretKey) {
    throw new PaymentConfigurationError("FLW_SECRET_KEY is not configured.", "missing_secret_key");
  }
  if (!FLUTTERWAVE_SECRET_KEY_PATTERN.test(secretKey)) {
    throw new PaymentConfigurationError(
      "FLW_SECRET_KEY must be a Flutterwave v3 live (FLWSECK-) or test (FLWSECK_TEST-) secret key.",
      "invalid_secret_key",
    );
  }
  return secretKey;
}

function requireFlutterwaveSecretHash(): string {
  const secretHash = process.env["FLW_SECRET_HASH"]?.trim();
  if (!secretHash) {
    throw new PaymentConfigurationError(
      "FLW_SECRET_HASH is not configured.",
      "missing_secret_hash",
    );
  }
  return secretHash;
}

export function verifyFlutterwaveWebhookHash(receivedHash: string | null): boolean {
  if (!receivedHash) return false;
  const expected = Buffer.from(requireFlutterwaveSecretHash(), "utf8");
  const received = Buffer.from(receivedHash.trim(), "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function validateFlutterwaveCheckoutUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PaymentProviderError(
      "Flutterwave returned an invalid checkout URL.",
      "invalid_checkout_url",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== FLUTTERWAVE_CHECKOUT_HOST ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith(FLUTTERWAVE_CHECKOUT_PATH_PREFIX)
  ) {
    throw new PaymentProviderError(
      `Flutterwave returned an unexpected checkout URL. Expected ${FLUTTERWAVE_CHECKOUT_HOST}.`,
      "unexpected_checkout_url",
    );
  }
  return url.toString();
}

async function flutterwaveRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${requireFlutterwaveSecretKey()}`);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new PaymentProviderError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Flutterwave timed out. Please try again."
        : "Flutterwave could not be reached. Please try again.",
      error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
    );
  }

  const text = await response.text();
  let payload: FlutterwaveEnvelope<T> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as FlutterwaveEnvelope<T>;
    } catch {
      throw new PaymentProviderError(
        "Flutterwave returned an unreadable response.",
        "invalid_response",
      );
    }
  }

  if (!response.ok || payload.status !== "success" || payload.data == null) {
    const message = payload.message?.trim() || `Flutterwave request failed (${response.status}).`;
    throw new PaymentProviderError(message, "provider_rejected");
  }
  return payload.data;
}

export function validatePublicSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PaymentConfigurationError(
      "PUBLIC_SITE_URL must be a valid absolute URL.",
      "invalid_public_site_url",
    );
  }
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const validProtocol = url.protocol === "https:" || (url.protocol === "http:" && isLocalhost);
  if (!validProtocol || url.username || url.password) {
    throw new PaymentConfigurationError(
      "PUBLIC_SITE_URL must use HTTPS, except for an HTTP localhost URL.",
      "invalid_public_site_url",
    );
  }
  return url.origin;
}

async function resolvePublicOrigin(): Promise<string> {
  const configuredOrigin =
    process.env["PUBLIC_SITE_URL"]?.trim() || process.env["APP_URL"]?.trim() || "";
  if (configuredOrigin) {
    return validatePublicSiteUrl(configuredOrigin);
  }
  if (process.env["VERCEL"] === "1") {
    throw new PaymentConfigurationError(
      "PUBLIC_SITE_URL is required on Vercel for trusted payment redirects.",
      "missing_public_site_url",
    );
  }
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (request) return new URL(request.url).origin;
  } catch {
    // Tests and background jobs must configure PUBLIC_SITE_URL explicitly.
  }
  throw new PaymentConfigurationError(
    "PUBLIC_SITE_URL is required for payment redirects.",
    "missing_public_site_url",
  );
}

function countOrderItems(order: OrderDocument): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export async function createFlutterwaveCheckout(order: OrderDocument): Promise<ProviderCheckout> {
  if (!order.payment_reference || !order.customer_email) {
    throw new PaymentConfigurationError("The pending order is missing Flutterwave checkout data.");
  }

  const origin = await resolvePublicOrigin();
  const redirectUrl = new URL("/api/payments/verify", origin);
  redirectUrl.searchParams.set("order_id", order.id);

  const data = await flutterwaveRequest<{ link?: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: order.payment_reference,
      amount: centsToDecimal(order.total_cents),
      currency: order.currency,
      redirect_url: redirectUrl.toString(),
      customer: {
        email: order.customer_email,
        name: order.customer_name,
        phonenumber: order.customer_phone ?? "",
      },
      meta: {
        order_id: order.id,
        order_number: order.order_number,
        expected_amount_cents: order.total_cents,
        expected_currency: order.currency,
      },
      customizations: {
        title: "Grill & Swill",
        description: `Order #${order.order_number} · ${countOrderItems(order)} item${countOrderItems(order) === 1 ? "" : "s"}`,
      },
    }),
  });

  if (!data.link) {
    throw new PaymentProviderError(
      "Flutterwave returned no checkout link.",
      "missing_checkout_url",
    );
  }
  return {
    provider: "flutterwave",
    reference: order.payment_reference,
    checkoutUrl: validateFlutterwaveCheckoutUrl(data.link),
    expiresAt: new Date(Date.now() + FLUTTERWAVE_CHECKOUT_SESSION_MINUTES * 60_000).toISOString(),
  };
}

async function prepareOrder(db: Db, data: ParsedInitializePaymentInput): Promise<PreparedOrder> {
  const ids = [...new Set(data.lines.map((line) => line.itemId))];
  const [items, , settings, storedPromotion] = await Promise.all([
    collection<MenuItem>(db, "menu_items")
      .find({ id: { $in: ids } })
      .project<MenuItem>({ _id: 0 })
      .toArray(),
    resolveOrderStoreId(db, data).catch((error: unknown) => {
      if (error instanceof OrderLocationError) throw new PaymentRequestError(error.message);
      throw error;
    }),
    db.collection<StorefrontPricingSettings>("site_settings").findOne({ _id: "storefront" }),
    data.promoCode
      ? db
          .collection<StoredPromotion>("promotions")
          .findOne({ code: data.promoCode.trim().toUpperCase() })
      : Promise.resolve(null),
  ]);

  const linkedIds = [
    ...new Set(
      items.flatMap((item) => [
        ...(item.bundle_components ?? []).flatMap((component) =>
          component.menu_item_id ? [component.menu_item_id] : [],
        ),
        ...item.options.flatMap((group) =>
          group.choices.flatMap((choice) => (choice.menu_item_id ? [choice.menu_item_id] : [])),
        ),
      ]),
    ),
  ];
  const linkedItems = linkedIds.length
    ? await collection<MenuItem>(db, "menu_items")
        .find({ id: { $in: linkedIds } })
        .project<MenuItem>({ _id: 0 })
        .toArray()
    : [];
  const byId = new Map([...items, ...linkedItems].map((item) => [item.id, item]));
  const snapshots: OrderLineSnapshot[] = [];
  const pricedLines: { category: CategoryId; lineTotalCents: number }[] = [];

  for (const line of data.lines) {
    const item = byId.get(line.itemId);
    if (!item) throw new PaymentRequestError("An item in your bag is no longer on the menu.");
    if (!item.is_available) {
      throw new PaymentRequestError(`${item.name} is sold out right now.`);
    }
    try {
      validateMenuBundle(item, line.selections, byId);
      const removed = line.removed.filter((ingredient) => item.ingredients.includes(ingredient));
      const unitPrice = unitPriceCents(
        { price_cents: item.price_cents, options: item.options },
        line.selections,
      );
      snapshots.push({
        itemId: item.id,
        slug: item.slug,
        name: item.name,
        imageKey: item.image_key,
        quantity: line.quantity,
        unitPriceCents: unitPrice,
        summary: selectionSummary({ options: item.options }, line.selections, removed),
        selections: line.selections,
        removed,
        note: line.note,
        bundleComponents: bundleComponentsFor(item, line.selections),
      });
      pricedLines.push({
        category: item.category,
        lineTotalCents: unitPrice * line.quantity,
      });
    } catch (error) {
      if (error instanceof PricingError) throw new PaymentRequestError(error.message);
      throw error;
    }
  }

  return { snapshots, pricedLines, settings, storedPromotion };
}

function databasePromotion(storedPromotion: StoredPromotion | null): PromoDefinition | null {
  if (!storedPromotion) return null;
  return {
    code: storedPromotion.code,
    label: storedPromotion.label,
    description: storedPromotion.description,
    kind: storedPromotion.kind,
    value: storedPromotion.value,
    ...(storedPromotion.minSubtotalCents !== undefined
      ? { minSubtotalCents: storedPromotion.minSubtotalCents }
      : {}),
    ...(storedPromotion.category ? { category: storedPromotion.category } : {}),
  };
}

function newFlutterwaveTransactionReference(): string {
  return `gsw-${randomUUID()}`;
}

function reusableFlutterwaveCheckout(order: OrderDocument): string | null {
  if (
    order.payment_status !== "pending" ||
    !order.payment_checkout_url ||
    !order.payment_reference
  ) {
    return null;
  }
  let checkoutUrl: string;
  try {
    checkoutUrl = validateFlutterwaveCheckoutUrl(order.payment_checkout_url);
  } catch {
    return null;
  }
  const expiry = order.payment_expires_at
    ? Date.parse(order.payment_expires_at)
    : Date.parse(order.payment_updated_at ?? order.updated_at) +
      FLUTTERWAVE_CHECKOUT_SESSION_MINUTES * 60_000;
  return Number.isFinite(expiry) && expiry > Date.now() ? checkoutUrl : null;
}

function checkoutInitializationIsActive(order: OrderDocument): boolean {
  if (order.payment_status !== "processing") return false;
  const updatedAt = Date.parse(order.payment_updated_at ?? order.updated_at);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < FLUTTERWAVE_INITIALIZATION_LOCK_MS;
}

async function checkoutForExistingOrder(
  order: OrderDocument,
  reused: boolean,
): Promise<InitializedFlutterwavePayment> {
  if (order.payment_status === "paid") {
    const origin = await resolvePublicOrigin();
    const orderUrl = new URL(`/orders/${order.id}`, origin);
    orderUrl.searchParams.set("token", createOrderAccessToken(order.id, order.guest_id));
    orderUrl.searchParams.set("payment", "successful");
    return {
      link: orderUrl.toString(),
      orderId: order.id,
      orderNumber: order.order_number,
      txRef: order.payment_reference ?? "",
      reused,
    };
  }

  const reusableCheckout = reusableFlutterwaveCheckout(order);
  if (reusableCheckout && order.payment_reference) {
    return {
      link: reusableCheckout,
      orderId: order.id,
      orderNumber: order.order_number,
      txRef: order.payment_reference,
      reused,
    };
  }

  if (checkoutInitializationIsActive(order)) {
    throw new PaymentRequestError(
      "Flutterwave checkout is already being prepared. Please try again in a moment.",
    );
  }
  if (!order.payment_reference || !order.payment_status) {
    throw new PaymentConfigurationError("The pending order is missing payment state.");
  }

  const { db } = await getMongoDatabase();
  const orders = collection<OrderDocument>(db, "orders");
  const txRef = newFlutterwaveTransactionReference();
  const claimedAt = new Date().toISOString();
  const claimed = await orders.updateOne(
    {
      id: order.id,
      payment_status: order.payment_status,
      payment_reference: order.payment_reference,
    },
    {
      $set: {
        payment_status: "processing",
        payment_reference: txRef,
        payment_updated_at: claimedAt,
        updated_at: claimedAt,
      },
      $unset: {
        payment_checkout_url: "",
        payment_expires_at: "",
        payment_failure_code: "",
      },
    },
  );
  if (!claimed.modifiedCount) {
    const latest = await orders.findOne({ id: order.id });
    if (latest) return checkoutForExistingOrder(latest, true);
    throw new PaymentRequestError("The payment order is no longer available.");
  }

  const claimedOrder: OrderDocument = {
    ...order,
    payment_status: "processing",
    payment_reference: txRef,
    payment_updated_at: claimedAt,
    updated_at: claimedAt,
  };

  try {
    const checkout = await createFlutterwaveCheckout(claimedOrder);
    const now = new Date().toISOString();
    const stored = await orders.updateOne(
      { id: order.id, payment_status: "processing", payment_reference: txRef },
      {
        $set: {
          payment_status: "pending",
          payment_checkout_url: checkout.checkoutUrl,
          payment_expires_at: checkout.expiresAt,
          payment_updated_at: now,
          updated_at: now,
        },
        $unset: { payment_failure_code: "" },
      },
    );
    if (!stored.modifiedCount) {
      const latest = await orders.findOne({ id: order.id });
      if (latest?.payment_status === "paid") return checkoutForExistingOrder(latest, true);
      throw new PaymentRequestError("The payment checkout state changed. Please try again.");
    }
    return {
      link: checkout.checkoutUrl,
      orderId: order.id,
      orderNumber: order.order_number,
      txRef: checkout.reference,
      reused,
    };
  } catch (error) {
    const now = new Date().toISOString();
    await orders.updateOne(
      { id: order.id, payment_status: "processing", payment_reference: txRef },
      {
        $set: {
          payment_status: "failed",
          payment_failure_code: "initialization_failed",
          payment_updated_at: now,
          updated_at: now,
        },
      },
    );
    throw error;
  }
}

/**
 * Creates a pending order and a Flutterwave Standard hosted checkout link.
 * Prices, promotions, availability, points and totals are recomputed from MongoDB.
 */
export async function initializeFlutterwavePayment(
  input: InitializeFlutterwavePaymentInput,
): Promise<InitializedFlutterwavePayment> {
  requireFlutterwaveSecretKey();
  const data = initializeFlutterwavePaymentSchema.parse(input);
  // Reject deployment configuration errors before creating or updating a pending order.
  await resolvePublicOrigin();
  const requestId = data.requestId ?? randomUUID();
  const { client, db } = await getMongoDatabase();
  const orders = collection<OrderDocument>(db, "orders");

  const existing = await orders.findOne({
    guest_id: data.guestId,
    checkout_request_id: requestId,
    payment_provider: "flutterwave",
  });
  if (existing) return checkoutForExistingOrder(existing, true);

  const prepared = await prepareOrder(db, data);
  const orderId = randomUUID();
  const txRef = newFlutterwaveTransactionReference();
  const session = client.startSession();
  let createdOrder: OrderDocument | null = null;

  try {
    await session.withTransaction(async () => {
      const duplicate = await orders.findOne(
        { guest_id: data.guestId, checkout_request_id: requestId },
        { session },
      );
      if (duplicate) {
        createdOrder = duplicate;
        return;
      }

      const guest = await collection<GuestDocument>(db, "guests").findOne(
        { id: data.guestId },
        { session },
      );
      if (prepared.storedPromotion && !prepared.storedPromotion.active) {
        throw new PaymentRequestError("That promo code is no longer active.");
      }
      if (
        prepared.storedPromotion?.usage_limit !== undefined &&
        (prepared.storedPromotion.usage_count ?? 0) >= prepared.storedPromotion.usage_limit
      ) {
        throw new PaymentRequestError("That promo code has reached its usage limit.");
      }

      const storedPromo = databasePromotion(prepared.storedPromotion);
      let totals;
      try {
        totals = computeTotals({
          lines: prepared.pricedLines,
          fulfillment: data.fulfillment,
          promoCode: data.promoCode,
          pointsToRedeem: data.pointsToRedeem,
          availablePoints: guest?.points ?? 0,
          promotions: storedPromo
            ? [...PROMOS.filter((promo) => promo.code !== storedPromo.code), storedPromo]
            : PROMOS,
          deliveryFeeCents: prepared.settings?.delivery_fee_cents ?? DELIVERY_FEE_CENTS,
          freeDeliveryThresholdCents:
            prepared.settings?.free_delivery_threshold_cents ?? FREE_DELIVERY_THRESHOLD_CENTS,
          pointsPerDollar: prepared.settings?.points_per_dollar,
          pointsPerDollarRedeemed: prepared.settings?.points_per_dollar_redeemed,
        });
      } catch (error) {
        if (error instanceof PricingError) throw new PaymentRequestError(error.message);
        throw error;
      }

      const clientAmountCents = decimalToCents(data.amount);
      if (clientAmountCents !== totals.totalCents || normalizedCurrency(data.currency) !== "USD") {
        throw new PaymentRequestError(
          "Your order total changed. Review the updated total and try again.",
        );
      }

      const counters = db.collection<{ _id: string; sequence: number }>("counters");
      await counters.updateOne(
        { _id: "orders" },
        { $inc: { sequence: 1 } },
        { upsert: true, session },
      );
      const counter = await counters.findOne({ _id: "orders" }, { session });
      if (!counter) throw new Error("Couldn't allocate an order number.");

      const now = new Date().toISOString();
      const orderNumber = counter.sequence + 1000;
      const normalizedAddress =
        data.fulfillment === "delivery" && data.address
          ? { ...data.address, name: data.name, phone: data.phone_number }
          : null;
      const order: OrderDocument = {
        id: orderId,
        order_number: orderNumber,
        receipt_number: `GS-${String(orderNumber).padStart(6, "0")}`,
        checkout_request_id: requestId,
        guest_id: data.guestId,
        status: "received",
        status_history: [{ status: "received", updated_at: now }],
        fulfillment: data.fulfillment,
        store_id: data.storeId,
        address: normalizedAddress,
        items: prepared.snapshots,
        currency: "USD",
        subtotal_cents: totals.subtotalCents,
        discount_cents: totals.discountCents,
        promo_code: totals.promoCode,
        points_redeemed: totals.pointsRedeemed,
        delivery_fee_cents: totals.deliveryFeeCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents,
        points_earned: totals.pointsEarned,
        payment_method: "Flutterwave Standard",
        payment_provider: "flutterwave",
        payment_status: "pending",
        payment_reference: txRef,
        payment_amount_cents: totals.totalCents,
        payment_currency: "USD",
        payment_updated_at: now,
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone_number,
        created_at: now,
        updated_at: now,
      };
      await orders.insertOne(order, { session });
      await collection<AdminLogDocument>(db, "admin_logs").insertOne(
        {
          id: randomUUID(),
          admin_id: null,
          action: "payment_order_created",
          details: {
            order_id: order.id,
            order_number: order.order_number,
            provider: "flutterwave",
          },
          created_at: now,
        },
        { session },
      );
      createdOrder = order;
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await orders.findOne({
        guest_id: data.guestId,
        checkout_request_id: requestId,
      });
      if (duplicate) return checkoutForExistingOrder(duplicate, true);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!createdOrder) throw new Error("The payment order could not be created.");
  return checkoutForExistingOrder(createdOrder, false);
}

async function verifyFlutterwaveTransaction(
  transactionId: string,
): Promise<FlutterwaveTransaction> {
  if (!/^\d+$/.test(transactionId)) {
    throw new PaymentVerificationError("Flutterwave returned an invalid transaction ID.");
  }
  return flutterwaveRequest<FlutterwaveTransaction>(
    `/transactions/${encodeURIComponent(transactionId)}/verify`,
    { method: "GET" },
  );
}

export function paymentOutcome(transaction: FlutterwaveTransaction): ProviderPaymentOutcome {
  const rawStatus = transaction.status?.trim().toLowerCase() ?? "";
  const status =
    rawStatus === "successful"
      ? "paid"
      : rawStatus.includes("cancel") || rawStatus === "abandoned"
        ? "cancelled"
        : rawStatus === "pending" || rawStatus === "processing"
          ? rawStatus
          : "failed";
  const last4 = transaction.card?.last_4digits?.replace(/\D/g, "").slice(-4);
  return {
    provider: "flutterwave",
    providerReference: transaction.tx_ref ?? "",
    status,
    amountCents: transaction.amount === undefined ? undefined : decimalToCents(transaction.amount),
    currency: normalizedCurrency(transaction.currency),
    transactionId: transaction.id === undefined ? undefined : String(transaction.id),
    paymentMethod: transaction.payment_type?.trim() || "Flutterwave",
    ...(last4?.length === 4 ? { last4 } : {}),
  };
}

export function assertFlutterwaveTransactionMatchesOrder(
  transaction: FlutterwaveTransaction,
  order: OrderDocument,
  expectedTransactionId?: string,
): ProviderPaymentOutcome {
  const outcome = paymentOutcome(transaction);
  if (expectedTransactionId && outcome.transactionId !== expectedTransactionId) {
    throw new PaymentVerificationError("The verified Flutterwave transaction ID did not match.");
  }
  if (!outcome.providerReference || outcome.providerReference !== order.payment_reference) {
    throw new PaymentVerificationError("The Flutterwave transaction reference did not match.");
  }
  if (outcome.status !== "paid") return outcome;
  if (outcome.amountCents !== order.total_cents) {
    throw new PaymentVerificationError("The verified payment amount did not match the order.");
  }
  if (outcome.currency !== order.currency) {
    throw new PaymentVerificationError("The verified payment currency did not match the order.");
  }
  const customerEmail = transaction.customer?.email?.trim().toLowerCase() ?? "";
  if (!order.customer_email || customerEmail !== order.customer_email.trim().toLowerCase()) {
    throw new PaymentVerificationError("The verified payment customer did not match the order.");
  }
  const metadataOrderId = transaction.meta?.order_id?.trim();
  if (metadataOrderId && metadataOrderId !== order.id) {
    throw new PaymentVerificationError("The verified payment metadata did not match the order.");
  }
  return outcome;
}

async function findFlutterwaveOrder(
  db: Db,
  txRef: string,
  expectedOrderId?: string,
): Promise<OrderDocument | null> {
  return collection<OrderDocument>(db, "orders").findOne({
    payment_provider: "flutterwave",
    payment_reference: txRef,
    ...(expectedOrderId ? { id: expectedOrderId } : {}),
  });
}

async function markUnsuccessfulPayment(
  order: OrderDocument,
  status: "cancelled" | "failed",
  failureCode: string,
): Promise<void> {
  const { db } = await getMongoDatabase();
  const now = new Date().toISOString();
  const statusHistory = [
    ...(order.status_history ?? [{ status: order.status, updated_at: order.created_at }]),
    ...(order.status === "cancelled" ? [] : [{ status: "cancelled" as const, updated_at: now }]),
  ];
  await collection<OrderDocument>(db, "orders").updateOne(
    { id: order.id, payment_status: { $ne: "paid" } },
    {
      $set: {
        payment_status: status,
        payment_failure_code: failureCode,
        payment_updated_at: now,
        status: "cancelled",
        status_history: statusHistory,
        updated_at: now,
      },
    },
  );
}

async function markPendingPayment(order: OrderDocument, status: "pending" | "processing") {
  const { db } = await getMongoDatabase();
  const now = new Date().toISOString();
  await collection<OrderDocument>(db, "orders").updateOne(
    { id: order.id, payment_status: { $ne: "paid" } },
    {
      $set: {
        payment_status: status,
        payment_updated_at: now,
        updated_at: now,
      },
      $unset: { payment_failure_code: "" },
    },
  );
}

export async function recordFlutterwaveCallbackStatus(input: {
  txRef: string;
  orderId?: string | null;
  status: "pending" | "cancelled" | "failed";
}): Promise<void> {
  const { db } = await getMongoDatabase();
  const order = await collection<OrderDocument>(db, "orders").findOne({
    payment_provider: "flutterwave",
    payment_reference: input.txRef,
    ...(input.orderId ? { id: input.orderId } : {}),
  });
  if (!order) return;
  if (input.status === "pending") {
    await markPendingPayment(order, "pending");
    return;
  }
  await markUnsuccessfulPayment(
    order,
    input.status,
    input.status === "cancelled" ? "customer_cancelled" : "provider_failed",
  );
}

async function applySuccessfulFlutterwavePayment(
  order: OrderDocument,
  outcome: ProviderPaymentOutcome,
): Promise<{ order: OrderDocument; alreadyProcessed: boolean }> {
  if (!outcome.transactionId) {
    throw new PaymentVerificationError("Flutterwave returned no transaction ID.");
  }
  const transactionId = outcome.transactionId;

  const { client, db } = await getMongoDatabase();
  const session = client.startSession();
  let alreadyProcessed = false;

  try {
    await session.withTransaction(async () => {
      alreadyProcessed = false;
      const orders = collection<OrderDocument>(db, "orders");
      const current = await orders.findOne({ id: order.id }, { session });
      if (!current) throw new PaymentVerificationError("The order could not be found.");

      if (current.payment_status === "paid") {
        if (current.payment_transaction_id && current.payment_transaction_id !== transactionId) {
          throw new PaymentVerificationError(
            "This order was already paid by a different transaction.",
          );
        }
        alreadyProcessed = true;
        return;
      }

      const transactionOwner = await orders.findOne(
        { payment_transaction_id: transactionId, id: { $ne: current.id } },
        { session },
      );
      if (transactionOwner) {
        throw new PaymentVerificationError(
          "This Flutterwave transaction was already applied to another order.",
        );
      }

      const now = new Date().toISOString();
      const update = await orders.updateOne(
        { id: current.id, payment_status: { $ne: "paid" } },
        {
          $set: {
            status: "received",
            status_history: [{ status: "received", updated_at: now }],
            payment_status: "paid",
            payment_transaction_id: transactionId,
            payment_amount_cents: outcome.amountCents,
            payment_currency: outcome.currency as "USD",
            payment_method: outcome.paymentMethod ?? "Flutterwave",
            ...(outcome.last4 ? { payment_last4: outcome.last4 } : {}),
            payment_updated_at: now,
            commerce_effects_status: "applied",
            created_at: now,
            updated_at: now,
          },
          $unset: { payment_failure_code: "" },
        },
        { session },
      );
      if (!update.modifiedCount) {
        alreadyProcessed = true;
        return;
      }

      // Financial side effects live in the same transaction as the paid transition so
      // redirect verification and webhook delivery cannot award points twice.
      const guests = collection<GuestDocument>(db, "guests");
      const guest = await guests.findOne({ id: current.guest_id }, { session });
      const currentPoints = guest?.points ?? 0;
      await guests.updateOne(
        { id: current.guest_id },
        {
          $set: {
            points: Math.max(0, currentPoints - current.points_redeemed) + current.points_earned,
            lifetime_points: (guest?.lifetime_points ?? 0) + current.points_earned,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true, session },
      );

      if (current.promo_code) {
        await db
          .collection<StoredPromotion>("promotions")
          .updateOne({ code: current.promo_code }, { $inc: { usage_count: 1 } }, { session });
      }

      await collection<UserDocument>(db, "users").updateOne(
        { id: current.guest_id },
        {
          $set: {
            is_guest: true,
            display_name: current.customer_name,
            phone: current.customer_phone ?? null,
            email: current.customer_email ?? null,
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true, session },
      );

      await collection<AdminLogDocument>(db, "admin_logs").insertOne(
        {
          id: randomUUID(),
          admin_id: null,
          action: "payment_completed",
          details: {
            order_id: current.id,
            order_number: current.order_number,
            provider: "flutterwave",
            transaction_id: transactionId,
          },
          created_at: now,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const updated = await collection<OrderDocument>(db, "orders").findOne({ id: order.id });
  if (!updated) throw new PaymentVerificationError("The paid order could not be loaded.");
  return { order: updated, alreadyProcessed };
}

/** Verifies the provider response and atomically fulfills the matching order once. */
export async function verifyAndFinalizeFlutterwavePayment(input: {
  transactionId: string;
  expectedTxRef?: string | null;
  expectedOrderId?: string | null;
}): Promise<FlutterwaveVerificationResult> {
  const transaction = await verifyFlutterwaveTransaction(input.transactionId);
  const outcome = paymentOutcome(transaction);
  if (outcome.transactionId !== input.transactionId) {
    throw new PaymentVerificationError("The verified Flutterwave transaction ID did not match.");
  }
  if (!outcome.providerReference) {
    throw new PaymentVerificationError("Flutterwave returned no transaction reference.");
  }
  if (input.expectedTxRef && input.expectedTxRef !== outcome.providerReference) {
    throw new PaymentVerificationError("The Flutterwave transaction reference did not match.");
  }

  const { db } = await getMongoDatabase();
  const order = await findFlutterwaveOrder(
    db,
    outcome.providerReference,
    input.expectedOrderId ?? undefined,
  );
  if (!order) throw new PaymentVerificationError("No order matches this Flutterwave payment.");

  let verifiedOutcome: ProviderPaymentOutcome;
  try {
    verifiedOutcome = assertFlutterwaveTransactionMatchesOrder(
      transaction,
      order,
      input.transactionId,
    );
  } catch (error) {
    if (outcome.status === "paid") {
      await markUnsuccessfulPayment(order, "failed", "verification_mismatch");
    }
    throw error;
  }

  if (verifiedOutcome.status === "pending" || verifiedOutcome.status === "processing") {
    await markPendingPayment(order, verifiedOutcome.status);
    return { successful: false, status: "pending", orderId: order.id };
  }
  if (verifiedOutcome.status !== "paid") {
    const status = verifiedOutcome.status === "cancelled" ? "cancelled" : "failed";
    await markUnsuccessfulPayment(order, status, `provider_${verifiedOutcome.status}`);
    return { successful: false, status, orderId: order.id };
  }

  const finalized = await applySuccessfulFlutterwavePayment(order, verifiedOutcome);
  return {
    successful: true,
    orderId: finalized.order.id,
    orderNumber: finalized.order.order_number,
    accessToken: createOrderAccessToken(finalized.order.id, finalized.order.guest_id),
    alreadyProcessed: finalized.alreadyProcessed,
  };
}

export async function claimFlutterwaveWebhookEvent(input: {
  eventType: string;
  transactionId: string;
  transactionStatus: string;
}): Promise<"claimed" | "processed" | "processing"> {
  const { db } = await getMongoDatabase();
  const events = collection<PaymentEventDocument>(db, "payment_events");
  const providerEventId = flutterwaveWebhookEventId(input);
  const now = new Date().toISOString();
  try {
    await events.insertOne({
      id: randomUUID(),
      provider: "flutterwave",
      provider_event_id: providerEventId,
      type: input.eventType,
      status: "processing",
      attempts: 1,
      created_at: now,
      updated_at: now,
    });
    return "claimed";
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }

  const existing = await events.findOne({
    provider: "flutterwave",
    provider_event_id: providerEventId,
  });
  if (existing?.status === "processed") return "processed";
  if (
    existing?.status === "processing" &&
    Date.now() - new Date(existing.updated_at).getTime() < 5 * 60_000
  ) {
    return "processing";
  }
  await events.updateOne(
    { provider: "flutterwave", provider_event_id: providerEventId },
    {
      $set: { status: "processing", updated_at: now },
      $inc: { attempts: 1 },
      $unset: { error_code: "" },
    },
  );
  return "claimed";
}

export async function completeFlutterwaveWebhookEvent(input: {
  eventType: string;
  transactionId: string;
  transactionStatus: string;
  orderId?: string;
}): Promise<void> {
  const { db } = await getMongoDatabase();
  const now = new Date().toISOString();
  await collection<PaymentEventDocument>(db, "payment_events").updateOne(
    {
      provider: "flutterwave",
      provider_event_id: flutterwaveWebhookEventId(input),
    },
    {
      $set: {
        status: "processed",
        ...(input.orderId ? { order_id: input.orderId } : {}),
        processed_at: now,
        updated_at: now,
      },
      $unset: { error_code: "" },
    },
  );
}

export async function failFlutterwaveWebhookEvent(input: {
  eventType: string;
  transactionId: string;
  transactionStatus: string;
  errorCode: string;
}): Promise<void> {
  const { db } = await getMongoDatabase();
  await collection<PaymentEventDocument>(db, "payment_events").updateOne(
    {
      provider: "flutterwave",
      provider_event_id: flutterwaveWebhookEventId(input),
    },
    {
      $set: {
        status: "failed",
        error_code: input.errorCode.slice(0, 80),
        updated_at: new Date().toISOString(),
      },
    },
  );
}

export function flutterwaveWebhookEventId(input: {
  eventType: string;
  transactionId: string;
  transactionStatus: string;
}): string {
  const status = input.transactionStatus.trim().toLowerCase() || "unknown";
  return [input.eventType, input.transactionId, status].map(encodeURIComponent).join(":");
}
