import { randomUUID } from "node:crypto";

import type Stripe from "stripe";
import type { ClientSession, Db } from "mongodb";

import type { CategoryId, MenuItem, OrderLineSnapshot, Store } from "./menu-types";
import type {
  AdminLogDocument,
  GuestDocument,
  OrderDocument,
  PaymentEventDocument,
  PaymentProvider,
  PaymentStatus,
  UserDocument,
} from "./mongodb.server";
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  centsToDecimal,
  decimalToCents,
  normalizedCurrency,
  type ProviderCheckout,
  type ProviderPaymentOutcome,
  type ProviderRefundOutcome,
  type PublicPaymentProvider,
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

type CheckoutLineInput = {
  itemId: string;
  quantity: number;
  selections: Record<string, string[]>;
  removed: string[];
  note: string;
};

export type BeginPaymentOrderInput = {
  guestId: string;
  requestId?: string;
  lines: CheckoutLineInput[];
  fulfillment: "delivery" | "pickup";
  storeId: string;
  address: {
    name: string;
    street: string;
    unit: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    instructions: string;
  } | null;
  pickupName?: string;
  promoCode?: string | null;
  pointsToRedeem: number;
  paymentProvider: PaymentProvider;
};

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

type PayPalEnvironment = "sandbox" | "live";
type PayPalLink = { href?: string; rel?: string; method?: string };
type PayPalAmount = { currency_code?: string; value?: string };
type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: PayPalAmount;
  custom_id?: string;
  invoice_id?: string;
  seller_receivable_breakdown?: { gross_amount?: PayPalAmount };
};
type PayPalPurchaseUnit = {
  reference_id?: string;
  custom_id?: string;
  invoice_id?: string;
  amount?: PayPalAmount;
  payments?: { captures?: PayPalCapture[] };
};
type PayPalOrder = {
  id?: string;
  status?: string;
  links?: PayPalLink[];
  purchase_units?: PayPalPurchaseUnit[];
  payment_source?: Record<string, unknown>;
};
type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

const STRIPE_API_VERSION = "2026-10-28.endive" as const;
const CHECKOUT_EXPIRY_SECONDS = 30 * 60;

let stripeClient: Stripe | undefined;
let paypalTokenCache: { value: string; expiresAt: number; environment: PayPalEnvironment } | undefined;

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isStripeConfigured(): boolean {
  return configured(process.env["STRIPE_SECRET_KEY"]);
}

export function paypalEnvironment(): PayPalEnvironment {
  return process.env["PAYPAL_ENVIRONMENT"]?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function isPayPalConfigured(): boolean {
  return configured(process.env["PAYPAL_CLIENT_ID"]) && configured(process.env["PAYPAL_CLIENT_SECRET"]);
}

export function getPublicPaymentConfiguration(): {
  currency: "USD";
  providers: PublicPaymentProvider[];
} {
  const stripeKey = process.env["STRIPE_SECRET_KEY"]?.trim() ?? "";
  return {
    currency: "USD",
    providers: [
      {
        id: "stripe",
        label: "Card & digital wallets",
        description: "Secure Stripe Checkout with eligible cards, Apple Pay, Google Pay, and local methods.",
        available: isStripeConfigured(),
        testMode: !stripeKey || !stripeKey.includes("_live_"),
      },
      {
        id: "paypal",
        label: "PayPal",
        description: "Pay with an eligible PayPal account through PayPal's hosted approval flow.",
        available: isPayPalConfigured(),
        testMode: paypalEnvironment() !== "live",
      },
    ],
  };
}

function ensureProviderConfigured(provider: PaymentProvider): void {
  if (provider === "stripe" && !isStripeConfigured()) {
    throw new PaymentConfigurationError("Card checkout is not configured yet.");
  }
  if (provider === "paypal" && !isPayPalConfigured()) {
    throw new PaymentConfigurationError("PayPal checkout is not configured yet.");
  }
}

async function getStripeClient(): Promise<Stripe> {
  const key = process.env["STRIPE_SECRET_KEY"]?.trim();
  if (!key) throw new PaymentConfigurationError("STRIPE_SECRET_KEY is not configured.");
  if (!stripeClient) {
    const { default: StripeClient } = await import("stripe");
    stripeClient = new StripeClient(key, {
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return stripeClient;
}

function paypalBaseUrl(environment: PayPalEnvironment = paypalEnvironment()): string {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env["PAYPAL_CLIENT_ID"]?.trim();
  const clientSecret = process.env["PAYPAL_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) {
    throw new PaymentConfigurationError("PayPal credentials are not configured.");
  }
  const environment = paypalEnvironment();
  if (
    paypalTokenCache &&
    paypalTokenCache.environment === environment &&
    paypalTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return paypalTokenCache.value;
  }
  const response = await fetch(`${paypalBaseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new PaymentConfigurationError(`PayPal authentication failed (${response.status}).`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new PaymentConfigurationError("PayPal returned no access token.");
  paypalTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 300) * 1000,
    environment,
  };
  return payload.access_token;
}

async function paypalRequest<T>(
  path: string,
  init: RequestInit & { requestId?: string } = {},
): Promise<T> {
  const token = await getPayPalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (init.requestId) headers.set("PayPal-Request-Id", init.requestId.slice(0, 108));
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const issue = payload as { name?: string; message?: string; debug_id?: string };
    const code = issue.name ?? `HTTP_${response.status}`;
    throw new Error(`PayPal ${code}: ${issue.message ?? "The request failed."}`);
  }
  return payload as T;
}

async function resolvePublicOrigin(): Promise<string> {
  const configuredOrigin =
    process.env["PUBLIC_SITE_URL"]?.trim() ?? process.env["APP_URL"]?.trim() ?? "";
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new PaymentConfigurationError("PUBLIC_SITE_URL must use HTTPS outside localhost.");
    }
    return url.origin;
  }
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (request) return new URL(request.url).origin;
  } catch {
    // Tests and non-request jobs must configure PUBLIC_SITE_URL explicitly.
  }
  throw new PaymentConfigurationError("PUBLIC_SITE_URL is required to create hosted checkout links.");
}

function checkoutReturnUrl(
  origin: string,
  orderId: string,
  provider: PaymentProvider,
  kind: "success" | "cancel",
): string {
  const url = new URL("/checkout/complete", origin);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("provider", provider);
  if (kind === "cancel") url.searchParams.set("cancelled", "1");
  return url.toString();
}

function countOrderItems(order: OrderDocument): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function randomLetters(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

async function createStripeCheckout(order: OrderDocument, origin: string): Promise<ProviderCheckout> {
  const stripe = await getStripeClient();
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS;
  const success = new URL(checkoutReturnUrl(origin, order.id, "stripe", "success"));
  success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const metadata = {
    order_id: order.id,
    order_number: String(order.order_number),
    expected_amount_cents: String(order.total_cents),
    expected_currency: order.currency,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: order.id,
      integration_identifier: `grill_swill_${randomLetters()}`,
      success_url: success.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
      cancel_url: checkoutReturnUrl(origin, order.id, "stripe", "cancel"),
      billing_address_collection: "auto",
      expires_at: expiresAtSeconds,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: order.total_cents,
            product_data: {
              name: `Grill & Swill order #${order.order_number}`,
              description: `${countOrderItems(order)} item${countOrderItems(order) === 1 ? "" : "s"} · ${order.fulfillment}`,
              metadata: { order_id: order.id },
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
    },
    { idempotencyKey: `checkout-${order.id}` },
  );
  if (!session.url) throw new Error("Stripe returned no Checkout URL.");
  return {
    provider: "stripe",
    reference: session.id,
    checkoutUrl: session.url,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

async function createPayPalCheckout(order: OrderDocument, origin: string): Promise<ProviderCheckout> {
  const response = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `checkout-${order.id}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.id,
          custom_id: order.id,
          invoice_id: order.receipt_number,
          description: `Grill & Swill order #${order.order_number}`,
          amount: {
            currency_code: order.currency,
            value: centsToDecimal(order.total_cents),
            breakdown: {
              item_total: {
                currency_code: order.currency,
                value: centsToDecimal(order.total_cents),
              },
            },
          },
          items: [
            {
              name: `Grill & Swill order #${order.order_number}`,
              description: `${countOrderItems(order)} item${countOrderItems(order) === 1 ? "" : "s"} · ${order.fulfillment}`,
              unit_amount: {
                currency_code: order.currency,
                value: centsToDecimal(order.total_cents),
              },
              quantity: "1",
              category: "PHYSICAL_GOODS",
            },
          ],
        },
      ],
      application_context: {
        brand_name: "Grill & Swill",
        user_action: "PAY_NOW",
        landing_page: "LOGIN",
        shipping_preference: "NO_SHIPPING",
        return_url: checkoutReturnUrl(origin, order.id, "paypal", "success"),
        cancel_url: checkoutReturnUrl(origin, order.id, "paypal", "cancel"),
      },
    }),
  });
  const approval = response.links?.find((link) => link.rel === "approve")?.href;
  if (!response.id || !approval) throw new Error("PayPal returned no approval URL.");
  return { provider: "paypal", reference: response.id, checkoutUrl: approval };
}

async function createProviderCheckout(order: OrderDocument): Promise<ProviderCheckout> {
  ensureProviderConfigured(order.payment_provider!);
  const origin = await resolvePublicOrigin();
  return order.payment_provider === "stripe"
    ? createStripeCheckout(order, origin)
    : createPayPalCheckout(order, origin);
}

