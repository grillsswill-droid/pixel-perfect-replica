import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryMongo } from "../tests/memory-mongo";

// Fresh process-local state; all real networking is denied by config preload.
const state = vi.hoisted(() => ({ database: undefined as any, sessionCalls: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((value: any) => any) | undefined;
    const builder = {
      validator(fn: (value: any) => any) { validator = fn; return builder; },
      handler(fn: (options: any) => any) { return async (options: any = {}) => fn({ data: validator ? validator(options.data) : options.data, context: {} }); },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => undefined,
  useSession: async () => { state.sessionCalls++; return { data: {}, update: async () => undefined, clear: async () => undefined }; },
}));
vi.mock("@/lib/mongodb.server", () => ({
  getMongoDatabase: async () => { state.database.databaseCalls++; return { client: state.database.client, db: state.database }; },
  collection: (db: any, name: string) => db.collection(name),
}));

import {
  assertFlutterwaveTransactionMatchesOrder,
  claimFlutterwaveWebhookEvent,
  verifyAndFinalizeFlutterwavePayment,
  verifyFlutterwaveWebhookHash,
  validateFlutterwaveCheckoutUrl,
} from "@/lib/payments.server";
import { Route as callbackRoute } from "@/routes/api.payments.verify";
import { Route as webhookRoute } from "@/routes/api.webhooks.flutterwave";
import { getOrder } from "@/lib/orders.functions";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access.server";

const orderId = "10000000-0000-4000-8000-000000000001";
const guestId = "10000000-0000-4000-8000-000000000002";
const txRef = "gsw-10000000-0000-4000-8000-000000000003";
const now = () => new Date().toISOString();
function order(overrides: any = {}) {
  return { id: orderId, guest_id: guestId, order_number: 1001, status: "received", status_history: [], fulfillment: "pickup", store_id: "10000000-0000-4000-8000-000000000004", address: null, items: [], currency: "USD", subtotal_cents: 1000, discount_cents: 0, total_cents: 1083, points_redeemed: 0, points_earned: 10, payment_provider: "flutterwave", payment_status: "paid", payment_reference: txRef, payment_transaction_id: "90001", customer_name: "Synthetic Guest", customer_email: "synthetic@example.invalid", customer_phone: "5125550100", created_at: now(), updated_at: now(), ...overrides };
}
function transaction(overrides: any = {}) {
  return { id: "90001", tx_ref: txRef, status: "successful", amount: "10.83", currency: "USD", customer: { email: "synthetic@example.invalid" }, meta: { order_id: orderId }, ...overrides };
}
function provider(response = transaction()) {
  const fetch = vi.fn(async (url: string) => {
    expect(url).toBe("https://api.flutterwave.com/v3/transactions/90001/verify");
    return Response.json({ status: "success", data: response });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const callback = (query: string) => (callbackRoute as any).options.server.handlers.GET({ request: new Request("https://audit.example.invalid/api/payments/verify?" + query) });
const webhook = (body: string, headers: Record<string, string> = { "verif-hash": "audit-only-webhook-placeholder" }) => (webhookRoute as any).options.server.handlers.POST({ request: new Request("https://audit.example.invalid/api/webhooks/flutterwave", { method: "POST", headers, body }) });

beforeEach(() => {
  state.database = new MemoryMongo();
  state.sessionCalls = 0;
  vi.stubEnv("SESSION_SECRET", "audit-only-signing-key-32-characters-minimum");
  vi.stubEnv("FLW_SECRET_KEY", "FLWSECK_TEST-audit-only-provider-placeholder");
  vi.stubEnv("FLW_SECRET_HASH", "audit-only-webhook-placeholder");
  vi.stubEnv("PUBLIC_SITE_URL", "https://audit.example.invalid");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Anonymous payment callbacks and order capabilities", () => {
  it("issues a private order capability from a numeric transaction ID alone", async () => {
    state.database.seed("orders", [order()]);
    const fetch = provider();
    const response = await callback("transaction_id=90001");
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe(`/orders/${orderId}`);
    const capability = location.searchParams.get("token")!;
    expect(verifyOrderAccessToken(capability, orderId, guestId)).toBe(true);
    const privateOrder = await getOrder({ data: { id: orderId, token: capability } });
    expect(privateOrder?.customer_email).toBe("synthetic@example.invalid");
    expect(privateOrder?.customer_phone).toBe("5125550100");
    expect(state.sessionCalls).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects a conflicting transaction reference", async () => {
    state.database.seed("orders", [order()]);
    provider();
    const response = await callback("transaction_id=90001&tx_ref=synthetic-wrong-reference");
    expect(new URL(response.headers.get("location")!).pathname).toBe("/checkout");
    expect(response.headers.get("location")).not.toContain("token=");
    expect(state.database.databaseCalls).toBe(0);
  });
  it("rejects a conflicting order ID", async () => {
    state.database.seed("orders", [order()]);
    provider();
    const response = await callback("transaction_id=90001&order_id=10000000-0000-4000-8000-000000000099");
    expect(new URL(response.headers.get("location")!).pathname).toBe("/checkout");
    expect(response.headers.get("location")).not.toContain("token=");
  });
  it("rejects path injection in transaction identifiers before any provider request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(verifyAndFinalizeFlutterwavePayment({ transactionId: "90001/../../other" })).rejects.toThrow("invalid transaction ID");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("allows unsigned GET callback state changes but protects already paid orders", async () => {
    state.database.seed("orders", [order({ payment_status: "pending", payment_transaction_id: undefined })]);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await callback(`tx_ref=${txRef}&status=cancelled`)).status).toBe(303);
    expect(state.database.rows("orders")[0].payment_status).toBe("cancelled");
    expect(state.database.rows("orders")[0].status).toBe("cancelled");
    expect(fetch).not.toHaveBeenCalled();
    expect(state.sessionCalls).toBe(0);
    state.database.seed("orders", [order()]);
    await callback(`tx_ref=${txRef}&status=cancelled`);
    expect(state.database.rows("orders")[0].payment_status).toBe("paid");
  });
});

describe("Provider consistency checks and URL restrictions", () => {
  it.each([
    { amount: "10.82" }, { currency: "NGN" }, { customer: { email: "other@example.invalid" } },
    { tx_ref: "synthetic-wrong-reference" }, { id: "90002" }, { meta: { order_id: "other-order" } },
  ])("rejects mismatching provider field %j", override => {
    expect(() => assertFlutterwaveTransactionMatchesOrder(transaction(override), order() as any, "90001")).toThrow();
  });
  it.each([
    "http://checkout.flutterwave.com/v3/hosted/pay/demo",
    "https://checkout.flutterwave.com.attacker.invalid/v3/hosted/pay/demo",
    "https://attacker.invalid/v3/hosted/pay/demo",
    "https://checkout.flutterwave.com:8443/v3/hosted/pay/demo",
    "https://user:pass@checkout.flutterwave.com/v3/hosted/pay/demo",
    "https://checkout.flutterwave.com/elsewhere",
    "javascript:alert(1)",
    "https://checkout.flutterwave.com/v3/hosted/pay/../../elsewhere",
  ])("rejects unsafe checkout URL %s", url => {
    expect(() => validateFlutterwaveCheckoutUrl(url)).toThrow();
  });
  it("permits only an expected HTTPS hosted checkout URL", () => {
    const url = "https://checkout.flutterwave.com/v3/hosted/pay/audit-only-placeholder";
    expect(validateFlutterwaveCheckoutUrl(url)).toBe(url);
  });
  it("does not recheck an attempt reference that changes between verification and settlement", async () => {
    const original = order({ payment_status: "pending", payment_transaction_id: undefined });
    state.database.seed("orders", [original]);
    provider();
    const originalStart = state.database.client.startSession;
    state.database.client.startSession = () => {
      const session = originalStart();
      const transaction = session.withTransaction;
      session.withTransaction = async (handler: () => Promise<void>) => {
        // Controlled interleaving: an expired checkout retries after old reference lookup.
        await state.database.collection("orders").updateOne({ id: orderId }, { $set: { payment_reference: "gsw-new-synthetic-attempt", payment_status: "pending" } });
        return transaction(handler);
      };
      return session;
    };
    expect((await verifyAndFinalizeFlutterwavePayment({ transactionId: "90001" })).successful).toBe(true);
    const settled = state.database.rows("orders")[0];
    expect(settled.payment_reference).toBe("gsw-new-synthetic-attempt");
    expect(settled.payment_transaction_id).toBe("90001");
    expect(settled.payment_status).toBe("paid");
  });
});

describe("Webhook authentication, validation and event claims", () => {
  it.each([null, "", "wrong", "audit-only-webhook-placeholder-extra"])("rejects invalid webhook hash %j", hash => {
    expect(verifyFlutterwaveWebhookHash(hash)).toBe(false);
  });
  it("accepts the configured hash and performs constant-time equal-length comparison", () => {
    expect(verifyFlutterwaveWebhookHash("audit-only-webhook-placeholder")).toBe(true);
  });
  it("returns 401 before database access for an unsigned webhook", async () => {
    const response = await webhook("{}", {});
    expect(response.status).toBe(401);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("rejects malformed signed payloads before database access", async () => {
    for (const body of ["{", "null", "[]", '{"event":"charge.completed","data":{"id":{"$ne":null}}}', '{"event":"charge.completed","data":{"id":"90001/other","status":"successful"}}']) {
      expect((await webhook(body)).status).toBe(400);
    }
    expect(state.database.databaseCalls).toBe(0);
  });
  it("ignores unrelated signed event types before database access", async () => {
    const response = await webhook(JSON.stringify({ event: "other-event", data: { id: "90001" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: true });
    expect(state.database.databaseCalls).toBe(0);
  });
  it("deduplicates a newly processing event", async () => {
    const input = { eventType: "charge.completed", transactionId: "90001", transactionStatus: "successful" };
    expect(await claimFlutterwaveWebhookEvent(input)).toBe("claimed");
    expect(await claimFlutterwaveWebhookEvent(input)).toBe("processing");
  });
  it("permanently acknowledges a successful event while the verification API still reports pending", async () => {
    state.database.seed("orders", [order({ payment_status: "pending", payment_transaction_id: undefined })]);
    const fetch = provider(transaction({ status: "pending" }));
    const payload = JSON.stringify({ event: "charge.completed", data: { id: "90001", tx_ref: txRef, status: "successful" } });
    const first = await webhook(payload);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true, verified: false });
    expect(state.database.rows("payment_events")[0].status).toBe("processed");
    expect(state.database.rows("orders")[0].payment_status).toBe("pending");
    fetch.mockResolvedValueOnce(Response.json({ status: "success", data: transaction() }));
    const replay = await webhook(payload);
    expect(await replay.json()).toEqual({ received: true, duplicate: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.database.rows("orders")[0].payment_status).toBe("pending");
  });
  it("permits two concurrent stale processing event claimants", async () => {
    const input = { eventType: "charge.completed", transactionId: "90001", transactionStatus: "successful" };
    state.database.seed("payment_events", [{ id: "synthetic-event", provider: "flutterwave", provider_event_id: "charge.completed:90001:successful", type: "charge.completed", status: "processing", attempts: 1, created_at: now(), updated_at: new Date(Date.now() - 10 * 60_000).toISOString() }]);
    const claims = await Promise.all([claimFlutterwaveWebhookEvent(input), claimFlutterwaveWebhookEvent(input)]);
    expect(claims).toEqual(["claimed", "claimed"]);
    expect(state.database.rows("payment_events")[0].attempts).toBe(3);
  });
});
