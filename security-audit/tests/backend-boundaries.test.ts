import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryMongo } from "./memory-mongo";

const state = vi.hoisted(() => ({
  database: undefined as any,
  sessions: {} as Record<string, any>,
  request: undefined as Request | undefined,
  sessionCalls: 0,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: (config: { method: string }) => {
    let validator: ((data: any) => any) | undefined;
    const builder = {
      validator(fn: (data: any) => any) { validator = fn; return builder; },
      handler(fn: (options: any) => any) {
        const call = async (options: any = {}) => fn({ data: validator ? validator(options.data) : options.data, context: {} });
        return Object.assign(call, { auditHandler: (data: any) => fn({ data, context: {} }), auditMethod: config.method });
      },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => state.request,
  useSession: async (config: any) => {
    state.sessionCalls++;
    state.sessions[config.name] ??= {};
    return {
      data: state.sessions[config.name],
      update: async (data: any) => { Object.assign(state.sessions[config.name], data); },
      clear: async () => { state.sessions[config.name] = {}; },
    };
  },
}));
vi.mock("@/lib/mongodb.server", () => ({
  getMongoDatabase: async () => { state.database.databaseCalls++; return { client: state.database.client, db: state.database }; },
  collection: (db: any, name: string) => db.collection(name),
}));

import * as admin from "@/lib/admin.functions";
import * as staff from "@/lib/staff.functions";
import { getCart, saveCart, saveCartSchema } from "@/lib/cart.functions";
import { getGuestRewards, getOrder, placeOrder, placeOrderSchema } from "@/lib/orders.functions";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access.server";
import { computeTotals } from "@/lib/pricing";
import {
  initializeFlutterwavePayment,
  initializeFlutterwavePaymentSchema,
  verifyAndFinalizeFlutterwavePayment,
  recordFlutterwaveCallbackStatus,
  claimFlutterwaveWebhookEvent,
} from "@/lib/payments.server";
import { handleInitializePaymentRequest } from "@/routes/api.payments.initialize";
import { Route as callbackRoute } from "@/routes/api.payments.verify";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = () => new Date().toISOString();
const menuItem = { id: id(20), slug: "audit-burger", category: "burgers", name: "Audit Burger", description: "Synthetic fixture", price_cents: 3000, calories: 1, image_key: "burger", tags: [], ingredients: [], options: [], is_available: true, is_featured: false, sort_order: 0 };
const line = { itemId: menuItem.id, quantity: 1, selections: {}, removed: [], note: "" };
const cartLine = { ...line, key: "audit-line", slug: menuItem.slug, category: "burgers" as const, name: menuItem.name, imageKey: "burger", unitPriceCents: 3000, summary: [] };
const baseOrder = (n: number, guest = id(1)) => ({ id: id(n), guest_id: guest, order_number: n + 1000, receipt_number: `GS-${n + 1000}`, checkout_request_id: id(n + 100), status: "received", fulfillment: "delivery", store_id: id(21), address: { name: "Synthetic Guest", street: "123 Synthetic Lane", unit: "", city: "Austin", state: "TX", zip: "78701", phone: "5125550100", instructions: "synthetic private address" }, items: [{ ...line, name: menuItem.name, imageKey: "burger", unitPriceCents: 3000, summary: [] }], currency: "USD", subtotal_cents: 3000, discount_cents: 0, promo_code: null, points_redeemed: 0, delivery_fee_cents: 0, tax_cents: 248, total_cents: 3248, points_earned: 300, payment_provider: "flutterwave", payment_status: "paid", payment_reference: `gsw-${id(n + 200)}`, customer_name: "Synthetic Guest", customer_email: "synthetic@example.invalid", customer_phone: "5125550100", created_at: now(), updated_at: now() });

beforeEach(() => {
  state.database = new MemoryMongo();
  state.sessions = {};
  state.sessionCalls = 0;
  state.request = undefined;
  vi.stubEnv("SESSION_SECRET", "audit-only-signing-key-32-characters-minimum");
  vi.stubEnv("ADMIN_PASSCODE", "audit-only-admin-correct-passcode");
  vi.stubEnv("STAFF_PASSCODE", "audit-only-staff-correct-passcode");
  vi.stubEnv("FLW_SECRET_KEY", "FLWSECK_TEST-audit-only-provider-placeholder");
  vi.stubEnv("PUBLIC_SITE_URL", "https://audit.example.invalid");
  state.database.seed("menu_items", [menuItem]);
  state.database.seed("stores", [{ id: id(21), name: "Synthetic Store" }]);
  state.database.seed("site_settings", [{ _id: "storefront", points_per_dollar: 1 }]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function mockProvider() {
  const transactions = new Map<string, any>();
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith("/payments")) return Response.json({ status: "success", data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/audit-only-placeholder" } });
    const transactionId = /\/transactions\/(\d+)\/verify$/.exec(url)?.[1];
    if (!transactionId || !transactions.has(transactionId)) throw new Error("Unexpected synthetic provider call");
    return Response.json({ status: "success", data: transactions.get(transactionId) });
  });
  vi.stubGlobal("fetch", fetch);
  return {
    fetch,
    transaction: (transactionId: string, order: any, override: any = {}) => transactions.set(transactionId, { id: transactionId, tx_ref: order.payment_reference, amount: (order.total_cents / 100).toFixed(2), currency: "USD", status: "successful", customer: { email: order.customer_email }, meta: { order_id: order.id }, ...override }),
  };
}
function paymentInput(request: number, guest = id(1), points = 0, promotion: any = null) {
  const totals = computeTotals({ lines: [{ category: "burgers", lineTotalCents: 3000 }], fulfillment: "pickup", pointsToRedeem: points, availablePoints: 1000, pointsPerDollar: 1, ...(promotion ? { promoCode: promotion.code, promotions: [promotion] } : {}) });
  return { guestId: guest, requestId: id(request), lines: [line], fulfillment: "pickup" as const, storeId: id(21), address: null, pointsToRedeem: points, promoCode: promotion?.code ?? null, email: "synthetic@example.invalid", name: "Synthetic Guest", phone_number: "5125550100", amount: totals.totalCents / 100, currency: "USD" as const };
}

describe("Guest ownership and order capabilities", () => {
  it("demonstrates a one-order read token expands into other orders and cart writes", async () => {
    state.database.seed("orders", [baseOrder(10), baseOrder(11)]);
    state.database.seed("guests", [{ id: id(1), points: 1000, lifetime_points: 1000 }]);
    state.database.seed("carts", [{ id: id(1), lines: [cartLine], fulfillment: "pickup", store_id: id(21) }]);
    const sharedOrderToken = createOrderAccessToken(id(10), id(1));
    const shared = await getOrder({ data: { id: id(10), token: sharedOrderToken } });
    expect(shared?.guest_id).toBe(id(1));
    const rewards = await getGuestRewards({ data: { guestId: shared!.guest_id } });
    const other = rewards.orders.find(order => order.id === id(11))!;
    expect(other.customer_email).toBe("synthetic@example.invalid");
    expect(other.address?.instructions).toBe("synthetic private address");
    expect(verifyOrderAccessToken(other.accessToken, id(11), id(1))).toBe(true);
    const secondOrder = await getOrder({ data: { id: id(11), token: other.accessToken } });
    expect(secondOrder?.id).toBe(id(11));
    await saveCart({ data: { guestId: shared!.guest_id, lines: [], fulfillment: "pickup", storeId: id(21) } });
    expect((await getCart({ data: { guestId: id(1) } }))?.lines).toEqual([]);
    expect(state.sessionCalls).toBe(0);
  });
  it("rejects an invalid order token without returning an order", async () => {
    state.database.seed("orders", [baseOrder(10)]);
    expect(await getOrder({ data: { id: id(10), token: "A".repeat(43) } })).toBeNull();
    const token = createOrderAccessToken(id(10), id(1));
    expect(verifyOrderAccessToken(token, id(11), id(1))).toBe(false);
    expect(verifyOrderAccessToken(token, id(10), id(2))).toBe(false);
  });
  it("shows order read capabilities have no expiration", () => {
    const token = createOrderAccessToken(id(10), id(1));
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(verifyOrderAccessToken(token, id(10), id(1))).toBe(true);
    clock.mockRestore();
  });
});

describe("Server role boundaries", () => {
  const guardedAdminNames = ["saveAdminMenuItem", "deleteAdminMenuItem", "saveAdminCategory", "saveAdminSettings", "saveStoreLocation", "deleteStoreLocation", "saveAdminPromotion", "deleteAdminPromotion", "saveAdminCateringPackage", "deleteAdminCateringPackage", "saveAdminCateringProtein", "deleteAdminCateringProtein", "updateAdminCateringInquiry", "saveAdminGalleryItem", "uploadAdminImage", "deleteAdminGalleryItem", "setAdminOrderStatus", "getAdminSales"] as const;
  it.each(guardedAdminNames)("denies anonymous and staff callers to %s before database access", async name => {
    const handler = (admin[name] as any).auditHandler;
    await expect(handler({ id: id(10), role: "admin", admin: true })).rejects.toThrow("Administrator access is required");
    state.sessions["gs-staff"] = { staff: true };
    await expect(handler({ id: id(10), role: "admin", admin: true })).rejects.toThrow("Administrator access is required");
    expect(state.database.databaseCalls).toBe(0);
  });
  it.each(["setOrderStatus", "setItemAvailability"] as const)("denies anonymous and admin-only callers to kitchen %s", async name => {
    const handler = (staff[name] as any).auditHandler;
    await expect(handler({ id: id(10), status: "kitchen", available: false })).rejects.toThrow("Kitchen screen is locked");
    state.sessions["gs-admin"] = { admin: true };
    await expect(handler({ id: id(10), status: "kitchen", available: false })).rejects.toThrow("Kitchen screen is locked");
    expect(state.database.databaseCalls).toBe(0);
  });
  it("returns locked dashboards without querying data", async () => {
    expect(await admin.getAdminWorkspace()).toEqual({ authenticated: false });
    expect(await staff.getKitchenBoard()).toEqual({ unlocked: false });
    expect(state.database.databaseCalls).toBe(0);
  });
  it("requires the configured admin passcode and ignores client role claims", async () => {
    expect(await admin.unlockAdmin({ data: { passcode: "wrong", admin: true } })).toEqual({ ok: false });
    expect((await admin.getAdminSessionState()).authenticated).toBe(false);
    expect(await admin.unlockAdmin({ data: { passcode: "audit-only-admin-correct-passcode" } })).toEqual({ ok: true });
    expect((await admin.getAdminSessionState()).authenticated).toBe(true);
    await admin.lockAdmin();
    expect((await admin.getAdminSessionState()).authenticated).toBe(false);
  });
  it("accepts a four-digit kitchen passcode and has no application attempt limit", async () => {
    vi.stubEnv("STAFF_PASSCODE", "1234");
    for (let n = 0; n < 20; n++) expect(await staff.unlockKitchen({ data: { passcode: "wrong" } })).toEqual({ ok: false });
    expect(await staff.unlockKitchen({ data: { passcode: "1234" } })).toEqual({ ok: true });
    expect(state.database.operations).toHaveLength(0);
  });
  it("accepts twenty incorrect admin attempts without an application throttle", async () => {
    for (let n = 0; n < 20; n++) expect(await admin.unlockAdmin({ data: { passcode: "wrong" } })).toEqual({ ok: false });
    expect(state.database.operations).toHaveLength(0);
  });
});

describe("Legacy demo checkout behavior", () => {
  it("creates an uncharged order, awards points, and allows kitchen fulfillment", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await placeOrder({ data: { guestId: id(1), requestId: id(50), lines: [line], fulfillment: "pickup", storeId: id(21), address: null, pickupName: "Synthetic Guest", pointsToRedeem: 0, paymentLast4: "4242" } });
    expect(result.ok).toBe(true);
    const order = state.database.rows("orders")[0];
    expect(order.payment_status).toBe("not_charged");
    expect(order.payment_provider).toBeUndefined();
    expect(state.database.rows("guests")[0].points).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
    state.sessions["gs-staff"] = { staff: true };
    const board = await staff.getKitchenBoard();
    expect(board.unlocked && board.orders.some(o => o.id === order.id)).toBe(true);
    await staff.setOrderStatus({ data: { id: order.id, status: "kitchen" } });
    expect(state.database.rows("orders")[0].status).toBe("kitchen");
  });
});

describe("Payment settlement and integrity", () => {
  it("rejects tampered totals before creating an order", async () => {
    mockProvider();
    const input = paymentInput(60);
    await expect(initializeFlutterwavePayment({ ...input, amount: input.amount - 0.01 })).rejects.toThrow("order total changed");
    expect(state.database.rows("orders")).toHaveLength(0);
  });
  it("demonstrates two pending checkouts redeem the same reward balance", async () => {
    const provider = mockProvider();
    state.database.seed("guests", [{ id: id(1), points: 1000, lifetime_points: 1000 }]);
    await initializeFlutterwavePayment(paymentInput(60, id(1), 1000));
    await initializeFlutterwavePayment(paymentInput(61, id(1), 1000));
    expect(state.database.rows("guests")[0].points).toBe(1000);
    const orders = state.database.rows("orders");
    expect(orders.map(o => o.points_redeemed)).toEqual([1000, 1000]);
    provider.transaction("10001", orders[0]);
    provider.transaction("10002", orders[1]);
    expect((await verifyAndFinalizeFlutterwavePayment({ transactionId: "10001" })).successful).toBe(true);
    expect(state.database.rows("guests")[0].points).toBe(20);
    expect((await verifyAndFinalizeFlutterwavePayment({ transactionId: "10002" })).successful).toBe(true);
    expect(state.database.rows("orders").filter(o => o.payment_status === "paid")).toHaveLength(2);
    expect(state.database.rows("orders").reduce((sum, o) => sum + o.points_redeemed, 0)).toBe(2000);
  });
  it("demonstrates a one-use coupon is applied to two paid checkouts", async () => {
    const provider = mockProvider();
    const promotion = { id: id(90), code: "AUDITPROMO", label: "Synthetic discount", description: "Test only", kind: "amount" as const, value: 500, active: true, usage_limit: 1, usage_count: 0 };
    state.database.seed("promotions", [promotion]);
    await initializeFlutterwavePayment(paymentInput(60, id(1), 0, promotion));
    await initializeFlutterwavePayment(paymentInput(61, id(2), 0, promotion));
    expect(state.database.rows("promotions")[0].usage_count).toBe(0);
    const orders = state.database.rows("orders");
    provider.transaction("10001", orders[0]);
    provider.transaction("10002", orders[1]);
    await verifyAndFinalizeFlutterwavePayment({ transactionId: "10001" });
    await verifyAndFinalizeFlutterwavePayment({ transactionId: "10002" });
    expect(state.database.rows("promotions")[0].usage_count).toBe(2);
  });
  it("does not award points twice when successful verification is replayed", async () => {
    const provider = mockProvider();
    await initializeFlutterwavePayment(paymentInput(60));
    provider.transaction("10001", state.database.rows("orders")[0]);
    expect((await verifyAndFinalizeFlutterwavePayment({ transactionId: "10001" })).successful).toBe(true);
    const points = state.database.rows("guests")[0].points;
    const replay = await verifyAndFinalizeFlutterwavePayment({ transactionId: "10001" });
    expect(replay.successful && replay.alreadyProcessed).toBe(true);
    expect(state.database.rows("guests")[0].points).toBe(points);
  });
  it("demonstrates an unsigned GET callback cancels a pending order", async () => {
    const provider = mockProvider();
    const checkout = await initializeFlutterwavePayment(paymentInput(60));
    const callsBefore = provider.fetch.mock.calls.length;
    const handler = (callbackRoute as any).options.server.handlers.GET;
    const response = await handler({ request: new Request(`https://audit.example.invalid/api/payments/verify?tx_ref=${checkout.txRef}&order_id=${checkout.orderId}&status=cancelled`) });
    expect(response.status).toBe(303);
    expect(state.database.rows("orders")[0].payment_status).toBe("cancelled");
    expect(provider.fetch.mock.calls.length).toBe(callsBefore);
    expect(state.sessionCalls).toBe(0);
  });
  it("protects a paid order from a forged cancellation callback", async () => {
    const order = baseOrder(10);
    state.database.seed("orders", [order]);
    await recordFlutterwaveCallbackStatus({ txRef: order.payment_reference, orderId: order.id, status: "cancelled" });
    expect(state.database.rows("orders")[0].payment_status).toBe("paid");
  });
  it("demonstrates checkout retry loses the reference needed for a delayed successful payment", async () => {
    const provider = mockProvider();
    await initializeFlutterwavePayment(paymentInput(60));
    const original = state.database.rows("orders")[0];
    await state.database.collection("orders").updateOne({ id: original.id }, { $set: { payment_expires_at: new Date(Date.now() - 1000).toISOString() } });
    await initializeFlutterwavePayment(paymentInput(60));
    const renewed = state.database.rows("orders")[0];
    expect(renewed.payment_reference).not.toBe(original.payment_reference);
    provider.transaction("10001", original);
    await expect(verifyAndFinalizeFlutterwavePayment({ transactionId: "10001" })).rejects.toThrow("No order matches");
    expect(state.database.rows("orders")[0].payment_status).toBe("pending");
  });
  it("deduplicates a fresh webhook claim", async () => {
    const input = { eventType: "charge.completed", transactionId: "10001", transactionStatus: "successful" };
    expect(await claimFlutterwaveWebhookEvent(input)).toBe("claimed");
    expect(await claimFlutterwaveWebhookEvent(input)).toBe("processing");
  });
});

describe("Controlled validation, abuse limits and parser cases", () => {
  it("rejects NoSQL operators, wrong types, protected fields, and malformed JSON", async () => {
    const valid = paymentInput(60);
    const cases = [null, [], {}, { ...valid, guestId: { $ne: null } }, { ...valid, amount: "32.48" }, { ...valid, role: "admin" }, { ...valid, payment_status: "paid" }, { ...valid, lines: [{ ...line, quantity: 0 }] }, { ...valid, lines: [{ ...line, quantity: 21 }] }, { ...valid, lines: Array(41).fill(line) }, { ...valid, address: { $where: "1" } }];
    for (const input of cases) expect(initializeFlutterwavePaymentSchema.safeParse(input).success).toBe(false);
    expect(saveCartSchema.safeParse({ guestId: { $ne: null }, lines: [], fulfillment: "pickup", storeId: null }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ guestId: { $where: "1" } }).success).toBe(false);
    for (const body of ["{", "null", "[]", '{"guestId":{"$gt":""}}']) {
      const response = await handleInitializePaymentRequest(new Request("https://audit.example.invalid/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body }));
      expect(response.status).toBe(400);
    }
    expect(state.database.databaseCalls).toBe(0);
  });
  it("demonstrates selection object key counts are not bounded by schema", () => {
    const selections = Object.fromEntries(Array.from({ length: 1500 }, (_, n) => [`synthetic_group_${n}`, []]));
    expect(initializeFlutterwavePaymentSchema.safeParse({ ...paymentInput(60), lines: [{ ...line, selections }] }).success).toBe(true);
  });
  it("blocks unrelated browser origins and rejects a declared oversized body", async () => {
    const foreign = await handleInitializePaymentRequest(new Request("https://audit.example.invalid/api/payments/initialize", { method: "POST", headers: { origin: "https://other.example.invalid", "content-type": "application/json" }, body: "{}" }));
    expect(foreign.status).toBe(403);
    const oversized = await handleInitializePaymentRequest(new Request("https://audit.example.invalid/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json", "content-length": "128001" }, body: "{}" }));
    expect(oversized.status).toBe(413);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("demonstrates the route consumes a body before enforcing the actual body limit", async () => {
    let bytesConsumed = 0;
    const stream = new ReadableStream({ pull(controller) { bytesConsumed += 65536; controller.enqueue(new Uint8Array(65536).fill(32)); if (bytesConsumed >= 4 * 65536) controller.close(); } });
    const request = new Request("https://audit.example.invalid/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    const response = await handleInitializePaymentRequest(request);
    expect(response.status).toBe(413);
    expect(bytesConsumed).toBe(4 * 65536);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("demonstrates the comment quota is bypassed by rotating guest identifiers", async () => {
    state.database.seed("gallery_items", [{ id: id(70), active: true }]);
    const input = { item_id: id(70), guest_id: id(1), author: "Synthetic Guest", text: "Harmless audit comment" };
    for (let n = 0; n < 5; n++) expect((await admin.addGalleryComment({ data: input })).ok).toBe(true);
    expect((await admin.addGalleryComment({ data: input })).ok).toBe(false);
    for (let n = 2; n < 7; n++) expect((await admin.addGalleryComment({ data: { ...input, guest_id: id(n) } })).ok).toBe(true);
    expect(state.database.rows("gallery_comments")).toHaveLength(10);
  });
});
