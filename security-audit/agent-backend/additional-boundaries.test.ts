import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvent, sealSession, useSession } from "h3";
import { MemoryMongo } from "../tests/memory-mongo";

const state = vi.hoisted(() => ({ db: undefined as any, event: undefined as any, config: undefined as any }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((data: any) => any) | undefined;
    const builder = {
      validator(fn: (data: any) => any) { validator = fn; return builder; },
      handler(fn: (options: any) => any) {
        return async (options: any = {}) => fn({ data: validator ? validator(options.data) : options.data, context: {} });
      },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  useSession: async (config: any) => {
    state.config = config;
    const { useSession } = await import("h3");
    return useSession(state.event, config);
  },
}));
import { addGalleryComment, getAdminSessionState, lockAdmin, submitCateringInquiry, unlockAdmin } from "@/lib/admin.functions";
import { getKitchenBoard, lockKitchen, staffSessionConfig, unlockKitchen } from "@/lib/staff.functions";
import { unitPriceCents } from "@/lib/pricing";
import { getGuestRewards, getOrder } from "@/lib/orders.functions";
import { getCart, saveCart } from "@/lib/cart.functions";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access.server";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const request = (headers: Record<string, string> = {}) => mockEvent("https://audit.example.invalid/", { headers });
beforeEach(() => {
  state.db = new MemoryMongo();
  // The app reuses this process-global connection promise. Populate it with the
  // in-memory substitute so parallel dynamic imports cannot bypass a Vite mock.
  (globalThis as any).__grillSwillMongoDatabase = Promise.resolve({ client: state.db.client, db: state.db });
  state.event = request();
  vi.stubEnv("SESSION_SECRET", "synthetic-audit-session-key-at-least-32-characters");
  vi.stubEnv("ADMIN_PASSCODE", "synthetic-audit-admin-passcode");
  vi.stubEnv("STAFF_PASSCODE", "synthetic-audit-staff-passcode");
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => { delete (globalThis as any).__grillSwillMongoDatabase; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Actual h3 session cryptography and invalidation", () => {
  it("replays the captured admin session after logout and passcode rotation", async () => {
    expect(await unlockAdmin({ data: { passcode: "synthetic-audit-admin-passcode" } })).toEqual({ ok: true });
    const config = state.config;
    const sealed = await sealSession(state.event, config);
    const originalId = (await useSession(state.event, config)).id;
    await lockAdmin();
    expect((await getAdminSessionState()).authenticated).toBe(false);
    vi.stubEnv("ADMIN_PASSCODE", "different-synthetic-admin-passcode");
    state.event = request({ cookie: `gs-admin=${sealed}` });
    expect((await getAdminSessionState()).authenticated).toBe(true);
    expect((await useSession(state.event, config)).id).toBe(originalId);
  });
  it("rejects an admin cookie with its cryptographic value altered", async () => {
    await unlockAdmin({ data: { passcode: "synthetic-audit-admin-passcode" } });
    const sealed = await sealSession(state.event, state.config);
    const altered = sealed.slice(0, -1) + (sealed.endsWith("a") ? "b" : "a");
    state.event = request({ cookie: `gs-admin=${altered}` });
    expect((await getAdminSessionState()).authenticated).toBe(false);
  });
  it("rejects a valid admin cookie after configured eight-hour expiry", async () => {
    await unlockAdmin({ data: { passcode: "synthetic-audit-admin-passcode" } });
    const sealed = await sealSession(state.event, state.config);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + (8 * 60 * 60 + 120) * 1000);
    state.event = request({ cookie: `gs-admin=${sealed}` });
    expect((await getAdminSessionState()).authenticated).toBe(false);
  });
  it("replays a captured kitchen cookie after logout and accepts the configured session header", async () => {
    await unlockKitchen({ data: { passcode: "synthetic-audit-staff-passcode" } });
    const config = staffSessionConfig();
    const sealed = await sealSession(state.event, config);
    await lockKitchen();
    state.event = request({ "x-gs-staff-session": sealed });
    expect((await useSession(state.event, config)).data.staff).toBe(true);
    state.db.seed("orders", []);
    state.db.seed("menu_items", []);
    state.db.seed("admin_logs", []);
    state.db.seed("stores", []);
    expect((await getKitchenBoard()).unlocked).toBe(true);
  });
  it("does not grant administrator rights from a staff-only cookie", async () => {
    await unlockKitchen({ data: { passcode: "synthetic-audit-staff-passcode" } });
    const sealed = await sealSession(state.event, staffSessionConfig());
    state.event = request({ cookie: `gs-admin=${sealed}` });
    expect((await getAdminSessionState()).authenticated).toBe(false);
  });
});

describe("Synthetic business-flow concurrency", () => {
  it("six concurrent comments bypass the five-comment per-device quota", async () => {
    state.db.seed("gallery_items", [{ id: id(70), active: true }]);
    const payload = { item_id: id(70), guest_id: id(1), author: "Synthetic Visitor", text: "Harmless synthetic comment" };
    const results = await Promise.all(Array.from({ length: 6 }, () => addGalleryComment({ data: payload })));
    expect(results.every(result => result.ok)).toBe(true);
    expect(state.db.rows("gallery_comments")).toHaveLength(6);
  });
  it("four concurrent catering inquiries bypass the three-inquiry per-device quota", async () => {
    const payload = { guest_id: id(1), name: "Synthetic Visitor", email: "audit@example.invalid", phone: "5125550100", event_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), guest_count: 10, package_id: null, message: "Harmless synthetic inquiry" };
    const results = await Promise.all(Array.from({ length: 4 }, () => submitCateringInquiry({ data: payload })));
    expect(results.every(result => result.ok)).toBe(true);
    expect(state.db.rows("catering_inquiries")).toHaveLength(4);
  });
});

describe("Guest capabilities against the actual Mongo adapter", () => {
  it("expands a shared single-order capability into private history and a second capability", async () => {
    const timestamp = new Date().toISOString();
    state.db.seed("orders", [10, 11].map(n => ({ id: id(n), guest_id: id(1), order_number: 1000 + n, receipt_number: `GS-${1000 + n}`, status: "received", payment_status: "paid", payment_provider: "flutterwave", fulfillment: "delivery", store_id: id(21), address: { street: "Synthetic private address" }, customer_email: "private@example.invalid", customer_phone: "5125550100", payment_reference: `synthetic-reference-${n}`, checkout_request_id: id(100 + n), created_at: timestamp, updated_at: timestamp })));
    state.db.seed("guests", [{ id: id(1), points: 1000, lifetime_points: 1000 }]);
    state.db.seed("stores", [{ id: id(21), name: "Synthetic Store" }]);
    const shared = await getOrder({ data: { id: id(10), token: createOrderAccessToken(id(10), id(1)) } });
    expect(shared?.guest_id).toBe(id(1));
    const history = await getGuestRewards({ data: { guestId: shared!.guest_id } });
    const second = history.orders.find(order => order.id === id(11))! as any;
    expect(second.address.street).toBe("Synthetic private address");
    expect(second.customer_email).toBe("private@example.invalid");
    expect(second.payment_reference).toBe("synthetic-reference-11");
    expect(second.checkout_request_id).toBe(id(111));
    expect(verifyOrderAccessToken(second.accessToken, id(11), id(1))).toBe(true);
    expect((await getOrder({ data: { id: id(11), token: second.accessToken } }))?.id).toBe(id(11));
  });
  it("allows a caller who knows another guest ID to read and overwrite that cart without a session", async () => {
    state.db.seed("carts", [{ id: id(1), lines: [{ note: "Synthetic private cart instruction" }], fulfillment: "pickup", store_id: id(21) }]);
    expect((await getCart({ data: { guestId: id(1) } }))?.lines[0].note).toBe("Synthetic private cart instruction");
    await saveCart({ data: { guestId: id(1), lines: [], fulfillment: "pickup", storeId: id(21) } });
    expect((await getCart({ data: { guestId: id(1) } }))?.lines).toEqual([]);
  });
  it("verifies the same order capability one year after issuance", () => {
    const token = createOrderAccessToken(id(10), id(1));
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 365 * 86400000);
    expect(verifyOrderAccessToken(token, id(10), id(1))).toBe(true);
  });
});

describe("Conditional catalog price-integrity case", () => {
  it("allows repeated negative-price multiselect choices if a privileged operator configures one", () => {
    const item = { price_cents: 3000, options: [{ id: "discount", label: "Discount", type: "multi" as const, choices: [{ id: "subtract", label: "Synthetic reduction", price_cents: -500 }] }] };
    expect(unitPriceCents(item, { discount: ["subtract"] })).toBe(2500);
    expect(unitPriceCents(item, { discount: ["subtract", "subtract", "subtract", "subtract"] })).toBe(1000);
  });
});
