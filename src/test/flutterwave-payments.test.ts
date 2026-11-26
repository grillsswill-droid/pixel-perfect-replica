import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PaymentProviderError,
  assertFlutterwaveTransactionMatchesOrder,
  createFlutterwaveCheckout,
  flutterwaveWebhookEventId,
  initializeFlutterwavePaymentSchema,
  paymentOutcome,
  validateFlutterwaveCheckoutUrl,
  validatePublicSiteUrl,
  verifyFlutterwaveWebhookHash,
} from "@/lib/payments.server";
import { PaymentConfigurationError, PaymentVerificationError } from "@/lib/payment-types";
import type { OrderDocument } from "@/lib/mongodb.server";
import * as mongodb from "@/lib/mongodb.server";
import { handleInitializePaymentRequest } from "@/routes/api.payments.initialize";
import { callbackPaymentStatus } from "@/routes/api.payments.verify";

const uuid = "00000000-0000-4000-8000-000000000001";

const paymentOrder: OrderDocument = {
  id: "00000000-0000-4000-8000-000000000010",
  order_number: 1010,
  guest_id: "00000000-0000-4000-8000-000000000011",
  status: "received",
  status_history: [{ status: "received", updated_at: "2026-11-25T00:00:00.000Z" }],
  fulfillment: "pickup",
  store_id: "00000000-0000-4000-8000-000000000012",
  address: null,
  items: [
    {
      itemId: uuid,
      name: "Test burger",
      imageKey: "test-burger",
      quantity: 1,
      unitPriceCents: 4250,
      summary: [],
      selections: {},
      removed: [],
      note: "",
    },
  ],
  currency: "USD",
  subtotal_cents: 4250,
  discount_cents: 0,
  promo_code: null,
  points_redeemed: 0,
  delivery_fee_cents: 0,
  tax_cents: 0,
  total_cents: 4250,
  points_earned: 42,
  payment_provider: "flutterwave",
  payment_status: "processing",
  payment_reference: "gsw-00000000-0000-4000-8000-000000000013",
  customer_name: "Pat Guest",
  customer_email: "pat@example.com",
  customer_phone: "+1 512 555 0100",
  created_at: "2026-11-25T00:00:00.000Z",
  updated_at: "2026-11-25T00:00:00.000Z",
};

const validPayment = {
  guestId: uuid,
  requestId: "00000000-0000-4000-8000-000000000002",
  lines: [
    {
      itemId: uuid,
      quantity: 1,
      selections: {},
      removed: [],
      note: "",
    },
  ],
  fulfillment: "delivery" as const,
  storeId: uuid,
  address: {
    name: "Pat Guest",
    street: "123 Main Street",
    unit: "",
    city: "Austin",
    state: "tx",
    zip: "78701",
    phone: "5125550100",
    instructions: "",
  },
  promoCode: null,
  pointsToRedeem: 0,
  email: "PAT@example.com",
  name: "Pat Guest",
  phone_number: "+1 512 555 0100",
  amount: 42.5,
  currency: "USD" as const,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Flutterwave payment request validation", () => {
  it("accepts delivery without a store and requires a store for pickup", () => {
    expect(
      initializeFlutterwavePaymentSchema.safeParse({ ...validPayment, storeId: null }).success,
    ).toBe(true);
    expect(
      initializeFlutterwavePaymentSchema.safeParse({
        ...validPayment,
        fulfillment: "pickup",
        storeId: null,
        address: null,
      }).success,
    ).toBe(false);
  });
  it("accepts checkout details and normalizes email and state", () => {
    const result = initializeFlutterwavePaymentSchema.parse(validPayment);

    expect(result.email).toBe("pat@example.com");
    expect(result.address?.state).toBe("TX");
    expect(result.amount).toBe(42.5);
  });

  it("rejects invalid customer data and sub-cent amounts", () => {
    expect(
      initializeFlutterwavePaymentSchema.safeParse({
        ...validPayment,
        email: "not-an-email",
        amount: 42.501,
      }).success,
    ).toBe(false);
  });
});

describe("Flutterwave initialization API route", () => {
  it("rejects cross-origin, non-JSON and malformed requests before payment processing", async () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://grill-swill.vercel.app");

    const crossOrigin = await handleInitializePaymentRequest(
      new Request("https://grill-swill.vercel.app/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: "{}",
      }),
    );
    expect(crossOrigin.status).toBe(403);

    const wrongContentType = await handleInitializePaymentRequest(
      new Request("https://grill-swill.vercel.app/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
    );
    expect(wrongContentType.status).toBe(415);

    const malformedJson = await handleInitializePaymentRequest(
      new Request("https://grill-swill.vercel.app/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(malformedJson.status).toBe(400);
    await expect(malformedJson.json()).resolves.toMatchObject({ ok: false });
    expect(malformedJson.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects structurally invalid checkout data without contacting Flutterwave", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await handleInitializePaymentRequest(
      new Request("https://grill-swill.vercel.app/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...validPayment, email: "not-an-email" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing", secretKey: undefined, code: "missing_secret_key" },
    { label: "public", secretKey: "FLWPUBK-live-unit-test-X", code: "invalid_secret_key" },
  ])("reports a $label secret key before creating an order", async ({ secretKey, code }) => {
    vi.stubEnv("FLW_SECRET_KEY", secretKey);
    vi.stubEnv("PUBLIC_SITE_URL", "https://grill-swill.vercel.app");
    vi.stubGlobal("fetch", vi.fn());
    const databaseMock = vi
      .spyOn(mongodb, "getMongoDatabase")
      .mockRejectedValue(
        new Error("Checkout must validate configuration before accessing orders."),
      );
    const logMock = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handleInitializePaymentRequest(
      new Request("https://grill-swill.vercel.app/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayment),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Flutterwave checkout is not configured yet.",
      code,
    });
    expect(databaseMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code, message: expect.any(String) }),
    );
    if (secretKey) expect(JSON.stringify(logMock.mock.calls)).not.toContain(secretKey);
  });

  it.each([
    { label: "missing", publicSiteUrl: undefined, code: "missing_public_site_url" },
    {
      label: "malformed",
      publicSiteUrl: "grill-swill.vercel.app",
      code: "invalid_public_site_url",
    },
    {
      label: "insecure",
      publicSiteUrl: "http://grill-swill.vercel.app",
      code: "invalid_public_site_url",
    },
  ])(
    "reports a $label redirect origin before creating an order",
    async ({ publicSiteUrl, code }) => {
      vi.stubEnv("FLW_SECRET_KEY", "FLWSECK-live-unit-test-X");
      vi.stubEnv("PUBLIC_SITE_URL", publicSiteUrl);
      vi.stubEnv("APP_URL", undefined);
      vi.stubEnv("VERCEL", "1");
      vi.stubGlobal("fetch", vi.fn());
      const databaseMock = vi
        .spyOn(mongodb, "getMongoDatabase")
        .mockRejectedValue(
          new Error("Checkout must validate redirect configuration before accessing orders."),
        );
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await handleInitializePaymentRequest(
        new Request("https://grill-swill.vercel.app/api/payments/initialize", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://grill-swill.vercel.app",
          },
          body: JSON.stringify(validPayment),
        }),
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ ok: false, code });
      expect(databaseMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe("Flutterwave webhook verification", () => {
  it("compares verif-hash using the configured secret", () => {
    vi.stubEnv("FLW_SECRET_HASH", "test-webhook-secret");

    expect(verifyFlutterwaveWebhookHash("test-webhook-secret")).toBe(true);
    expect(verifyFlutterwaveWebhookHash("wrong-secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash(null)).toBe(false);
  });

  it("deduplicates retries without suppressing later status transitions", () => {
    const failed = flutterwaveWebhookEventId({
      eventType: "charge.completed",
      transactionId: "12345",
      transactionStatus: "failed",
    });
    const successful = flutterwaveWebhookEventId({
      eventType: "charge.completed",
      transactionId: "12345",
      transactionStatus: "successful",
    });

    expect(failed).toBe("charge.completed:12345:failed");
    expect(successful).not.toBe(failed);
  });
});

describe("Flutterwave Standard checkout", () => {
  it.each([
    { mode: "test", secretKey: "FLWSECK_TEST-unit-test-X" },
    { mode: "live", secretKey: "FLWSECK-live-unit-test-X" },
    { mode: "live with surrounding whitespace", secretKey: "  FLWSECK-live-unit-test-X\n" },
  ])("creates an official hosted checkout with $mode credentials", async ({ secretKey }) => {
    vi.stubEnv("FLW_SECRET_KEY", secretKey);
    vi.stubEnv("PUBLIC_SITE_URL", "https://grill-swill.vercel.app");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        status: "success",
        message: "Hosted Link",
        data: {
          link: "https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-test-123",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const checkout = await createFlutterwaveCheckout(paymentOrder);

    expect(checkout.checkoutUrl).toBe(
      "https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-test-123",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(requestUrl).toBe("https://api.flutterwave.com/v3/payments");
    expect(new Headers(requestInit.headers).get("authorization")).toBe(
      `Bearer ${secretKey.trim()}`,
    );
    const body = JSON.parse(String(requestInit.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      tx_ref: paymentOrder.payment_reference,
      amount: "42.50",
      currency: "USD",
      redirect_url: `https://grill-swill.vercel.app/api/payments/verify?order_id=${paymentOrder.id}`,
      customer: {
        email: "pat@example.com",
        name: "Pat Guest",
        phonenumber: "+1 512 555 0100",
      },
    });
    expect(body).not.toHaveProperty("configurations");
  });

  it("rejects provider failures and unexpected development checkout domains", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "FLWSECK_TEST-unit-test-X");
    vi.stubEnv("PUBLIC_SITE_URL", "https://grill-swill.vercel.app");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(
          { status: "error", message: "Invalid authorization", data: null },
          {
            status: 401,
          },
        ),
      ),
    );
    await expect(createFlutterwaveCheckout(paymentOrder)).rejects.toMatchObject({
      code: "provider_rejected",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json({
          status: "success",
          data: { link: "https://dev-flutterwave.com/pay/test" },
        }),
      ),
    );
    await expect(createFlutterwaveCheckout(paymentOrder)).rejects.toMatchObject({
      code: "unexpected_checkout_url",
    });
  });

  it.each([
    { label: "missing", secretKey: undefined, code: "missing_secret_key" },
    { label: "blank", secretKey: "  ", code: "missing_secret_key" },
    { label: "public", secretKey: "FLWPUBK_TEST-unit-test-X", code: "invalid_secret_key" },
    { label: "unrecognized", secretKey: "not-a-flutterwave-key", code: "invalid_secret_key" },
    { label: "quoted", secretKey: '"FLWSECK-live-unit-test-X"', code: "invalid_secret_key" },
    {
      label: "trailing-quote",
      secretKey: 'FLWSECK-live-unit-test-X"',
      code: "invalid_secret_key",
    },
    { label: "empty", secretKey: "FLWSECK-", code: "invalid_secret_key" },
    { label: "internal-whitespace", secretKey: "FLWSECK-live key-X", code: "invalid_secret_key" },
    {
      label: "Bearer-prefixed",
      secretKey: "Bearer FLWSECK-live-unit-test-X",
      code: "invalid_secret_key",
    },
  ])("rejects $label credentials before contacting Flutterwave", async ({ secretKey, code }) => {
    vi.stubEnv("FLW_SECRET_KEY", secretKey);
    vi.stubEnv("PUBLIC_SITE_URL", "https://grill-swill.vercel.app");
    vi.stubGlobal("fetch", vi.fn());

    await expect(createFlutterwaveCheckout(paymentOrder)).rejects.toMatchObject({
      name: "PaymentConfigurationError",
      code,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Flutterwave URL validation", () => {
  it("accepts the documented checkout host and secure production origins", () => {
    expect(
      validateFlutterwaveCheckoutUrl(
        "https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-test-123",
      ),
    ).toBe("https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-test-123");
    expect(validatePublicSiteUrl("https://grill-swill.vercel.app/checkout")).toBe(
      "https://grill-swill.vercel.app",
    );
    expect(validatePublicSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects insecure origins and lookalike checkout hosts", () => {
    expect(() => validatePublicSiteUrl("http://grill-swill.vercel.app")).toThrow(
      PaymentConfigurationError,
    );
    expect(() =>
      validateFlutterwaveCheckoutUrl(
        "https://checkout.flutterwave.com.evil.example/v3/hosted/pay/test",
      ),
    ).toThrow(PaymentProviderError);
  });
});

describe("Flutterwave transaction verification", () => {
  const successfulTransaction = {
    id: 12345,
    tx_ref: paymentOrder.payment_reference,
    amount: 42.5,
    currency: "usd",
    status: "successful",
    payment_type: "card",
    customer: { email: "PAT@example.com" },
    meta: { order_id: paymentOrder.id, order_number: paymentOrder.order_number },
    card: { last_4digits: "4242" },
  };

  it("matches ID, reference, exact amount, currency, customer and order metadata", () => {
    expect(
      assertFlutterwaveTransactionMatchesOrder(successfulTransaction, paymentOrder, "12345"),
    ).toMatchObject({
      status: "paid",
      providerReference: paymentOrder.payment_reference,
      amountCents: 4250,
      currency: "USD",
      transactionId: "12345",
      last4: "4242",
    });
  });

  it("rejects amount and customer mismatches", () => {
    expect(() =>
      assertFlutterwaveTransactionMatchesOrder(
        { ...successfulTransaction, amount: 41.5 },
        paymentOrder,
        "12345",
      ),
    ).toThrow(PaymentVerificationError);
    expect(() =>
      assertFlutterwaveTransactionMatchesOrder(
        { ...successfulTransaction, customer: { email: "someone@example.com" } },
        paymentOrder,
        "12345",
      ),
    ).toThrow("customer did not match");
  });

  it("preserves pending and treats abandoned payments as cancelled", () => {
    expect(paymentOutcome({ ...successfulTransaction, status: "pending" }).status).toBe("pending");
    expect(paymentOutcome({ ...successfulTransaction, status: "abandoned" }).status).toBe(
      "cancelled",
    );
    expect(callbackPaymentStatus("processing")).toBe("pending");
    expect(callbackPaymentStatus("abandoned")).toBe("cancelled");
    expect(callbackPaymentStatus("failed")).toBe("failed");
  });
});
