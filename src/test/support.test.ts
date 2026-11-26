import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SupportMemoryMongo } from "./support-memory";

const sessions = vi.hoisted(() => ({ admin: false, staff: false }));
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: <T>(handler: T) => handler,
  createServerFn: () => {
    const builder = { validator: () => builder, handler: () => vi.fn() };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  useSession: async (configuration: { name: string }) => ({
    data: configuration.name === "gs-admin" ? { admin: sessions.admin } : { staff: sessions.staff },
    update: async () => undefined,
    clear: async () => undefined,
  }),
}));

import * as mongodb from "@/lib/mongodb.server";
import {
  getAdminSupportInboxData,
  getAdminSupportRequestData,
  handleSupportRequest,
  replyAdminSupportRequestData,
  retryAdminSupportNotificationData,
  setAdminSupportStatusData,
} from "@/lib/support.server";
import { supportReplySchema, supportRequestSchema } from "@/lib/support-types";

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const origin = "https://grill-swill.com";
const cache = globalThis as typeof globalThis & { __grillSwillMongoDatabase?: Promise<unknown> };
let previousCache: Promise<unknown> | undefined;
let db: SupportMemoryMongo;
let fetchMock: ReturnType<typeof vi.fn>;

function input(number = 1, overrides: Record<string, unknown> = {}) {
  return {
    requestId: id(number),
    name: "Synthetic Customer",
    email: "synthetic@example.invalid",
    subject: "Synthetic order question",
    message: "Please review this harmless synthetic order question.",
    topic: "order_issue",
    orderReference: "GS-000123",
    ...overrides,
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/support`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  });
}

function configureMail() {
  vi.stubEnv("RESEND_API_KEY", "re_synthetic_provider_placeholder");
  vi.stubEnv("SUPPORT_EMAIL", "inbox@example.invalid");
  vi.stubEnv("SUPPORT_FROM_EMAIL", "sender@example.invalid");
  fetchMock.mockImplementation(async () => Response.json({ id: "synthetic_email_id" }));
}

beforeEach(() => {
  previousCache = cache.__grillSwillMongoDatabase;
  db = new SupportMemoryMongo();
  cache.__grillSwillMongoDatabase = Promise.resolve({ db, client: db.client });
  sessions.admin = false;
  sessions.staff = false;
  vi.stubEnv("SESSION_SECRET", "synthetic-support-signing-secret-longer-than-32");
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:1/synthetic-no-network");
  vi.stubEnv("PUBLIC_SITE_URL", origin);
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SUPPORT_EMAIL", "");
  vi.stubEnv("SUPPORT_FROM_EMAIL", "");
  vi.stubEnv("SUPPORT_TRUSTED_IP_HEADER", "");
  fetchMock = vi.fn(async () => {
    throw new Error("Unexpected provider request in isolated test");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  if (previousCache === undefined) delete cache.__grillSwillMongoDatabase;
  else cache.__grillSwillMongoDatabase = previousCache;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Support validation and public request boundary", () => {
  it("normalizes contact fields while preserving readable multiline messages", () => {
    const parsed = supportRequestSchema.parse(
      input(1, {
        name: "  Synthetic Customer  ",
        email: "  SYNTHETIC@EXAMPLE.INVALID  ",
        message: "First synthetic line.\nSecond synthetic line.",
      }),
    );
    expect(parsed.name).toBe("Synthetic Customer");
    expect(parsed.email).toBe("synthetic@example.invalid");
    expect(parsed.message).toContain("\n");
  });

  it.each([
    null,
    [],
    {},
    input(1, { requestId: { $ne: null } }),
    input(1, { name: "A" }),
    input(1, { email: "not-an-email" }),
    input(1, { subject: "x" }),
    input(1, { message: "short" }),
    input(1, { message: "x".repeat(4001) }),
    input(1, { name: "Synthetic\r\nHeader" }),
    input(1, { subject: "Synthetic\nHeader" }),
    input(1, { orderReference: "x".repeat(81) }),
    input(1, { status: "resolved" }),
    input(1, { role: "admin" }),
    input(1, { topic: "unlisted-topic" }),
  ])("rejects invalid or protected input before storage: %#", async (value) => {
    expect(supportRequestSchema.safeParse(value).success).toBe(false);
    const response = await handleSupportRequest(request(value));
    expect(response.status).toBe(400);
    expect(db.operations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, unsupported content types and cross-site requests", async () => {
    const malformed = new Request(`${origin}/api/support`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect((await handleSupportRequest(malformed)).status).toBe(400);
    expect(
      (await handleSupportRequest(request(input(), { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await handleSupportRequest(request(input(), { origin: "https://other-grill-swill.com" })))
        .status,
    ).toBe(403);
    expect(
      (await handleSupportRequest(request(input(), { "sec-fetch-site": "cross-site" }))).status,
    ).toBe(403);
    expect(db.operations).toEqual([]);
  });

  it("does not expose a public inbox or lookup by email/request ID", async () => {
    await handleSupportRequest(request(input()));
    const response = await handleSupportRequest(
      new Request(`${origin}/api/support?email=synthetic@example.invalid&requestId=${id(1)}`),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.text()).not.toContain("Synthetic Customer");
  });

  it("stops reading an oversized undeclared stream and cancels it", async () => {
    let produced = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += 8192;
        controller.enqueue(new Uint8Array(8192).fill(32));
        if (produced >= 65536) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamed = new Request(`${origin}/api/support`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await handleSupportRequest(streamed)).status).toBe(413);
    expect(produced).toBeLessThan(65536);
    expect(cancelled).toBe(true);
    expect(db.operations).toEqual([]);
  });

  it("cancels a stalled active reader when the request deadline expires", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const pending = handleSupportRequest(
      new Request(`${origin}/api/support`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(10_001);
    const response = await pending;
    expect(response.status).toBe(408);
    expect(cancelled).toBe(true);
    expect(db.operations).toEqual([]);
  });
});

describe("Durable acknowledgement, idempotency and spam limits", () => {
  it("acknowledges durable storage without exposing PII or claiming email delivery", async () => {
    const response = await handleSupportRequest(request(input()));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.json()).toEqual({ ok: true, reference: `GS-${id(1).toUpperCase()}` });
    expect(db.rows("support_requests")).toHaveLength(1);
    expect(db.rows("support_requests")[0]!.notification_delivery).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries the same request without duplicating storage or quota, and rejects changed payloads", async () => {
    const first = await handleSupportRequest(request(input()));
    const repeated = await handleSupportRequest(request(input()));
    expect(await repeated.json()).toEqual(await first.json());
    expect(db.rows("support_requests")).toHaveLength(1);
    expect(db.rows("support_rate_limits").every((counter) => counter.count === 1)).toBe(true);
    const changed = await handleSupportRequest(
      request(input(1, { message: "A different synthetic message under the same request ID." })),
    );
    expect(changed.status).toBe(409);
    expect(db.rows("support_requests")[0]!.message).toBe(input().message);
  });

  it("limits one normalized email and stores opaque counters instead of raw contact keys", async () => {
    for (const number of [1, 2, 3])
      expect((await handleSupportRequest(request(input(number)))).status).toBe(202);
    const rejected = await handleSupportRequest(
      request(input(4, { email: " SYNTHETIC@EXAMPLE.INVALID " })),
    );
    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(db.rows("support_requests")).toHaveLength(3);
    expect(JSON.stringify(db.rows("support_rate_limits"))).not.toContain(
      "synthetic@example.invalid",
    );
  });

  it("enforces the global quota even when an attacker rotates email addresses", async () => {
    const now = Date.now();
    db.seed("support_rate_limits", [
      {
        _id: "global-minute",
        count: 30,
        window_start: Math.floor(now / 60000) * 60000,
        expires_at: new Date(now + 60000).toISOString(),
      },
    ]);
    expect(
      (await handleSupportRequest(request(input(1, { email: "another@example.invalid" })))).status,
    ).toBe(429);
    expect(db.rows("support_requests")).toHaveLength(0);
    expect(db.rows("support_rate_limits")[0]!.count).toBe(30);
  });

  it("uses network quotas only with an explicitly trusted configured header", async () => {
    await handleSupportRequest(request(input(1), { "x-real-ip": "203.0.113.42" }));
    expect(
      db.rows("support_rate_limits").some((counter) => String(counter._id).startsWith("network:")),
    ).toBe(false);
    vi.stubEnv("SUPPORT_TRUSTED_IP_HEADER", "x-real-ip");
    await handleSupportRequest(
      request(input(2, { email: "another@example.invalid" }), { "x-real-ip": "203.0.113.42" }),
    );
    const counter = db
      .rows("support_rate_limits")
      .find((row) => String(row._id).startsWith("network:"))!;
    expect(counter).toBeDefined();
    expect(counter._id).not.toContain("203.0.113.42");
    await db
      .collection("support_rate_limits")
      .updateOne({ _id: counter._id }, { $set: { count: 5 } });
    expect(
      (
        await handleSupportRequest(
          request(input(3, { email: "third@example.invalid" }), { "x-real-ip": "203.0.113.42" }),
        )
      ).status,
    ).toBe(429);
  });

  it("reports persistence/configuration failure without success or internal details", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const missing = await handleSupportRequest(request(input()));
    expect(missing.status).toBe(503);
    expect((await missing.json()).ok).toBe(false);
    expect(db.operations).toEqual([]);
    vi.stubEnv("SESSION_SECRET", "synthetic-support-signing-secret-longer-than-32");
    vi.spyOn(mongodb, "getMongoDatabase").mockRejectedValueOnce(
      new Error("synthetic-sensitive-storage-detail"),
    );
    const failed = await handleSupportRequest(request(input()));
    expect(failed.status).toBe(503);
    const text = await failed.text();
    expect(text).not.toContain("synthetic-sensitive-storage-detail");
    expect(JSON.parse(text).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a saved request acknowledged when configured notification delivery fails", async () => {
    configureMail();
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Synthetic provider rejection" }, { status: 500 }),
    );
    const response = await handleSupportRequest(request(input()));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, reference: `GS-${id(1).toUpperCase()}` });
    expect(db.rows("support_requests")[0]!.notification_delivery).toBe("failed");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const mail = JSON.parse(options.body);
    expect(mail.to).toEqual(["inbox@example.invalid"]);
    expect(mail.reply_to).toBe("synthetic@example.invalid");
    expect(mail.html).toBeUndefined();
    expect(mail.text).toContain("Synthetic order question");
    await handleSupportRequest(request(input()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Administrative support authority and bounded replies", () => {
  it.each([
    () => getAdminSupportInboxData({}),
    () => getAdminSupportRequestData({ id: id(1) }),
    () => setAdminSupportStatusData({ id: id(1), status: "resolved" }),
    () =>
      replyAdminSupportRequestData({
        id: id(1),
        replyId: id(99),
        message: "Harmless synthetic staff reply.",
      }),
    () => retryAdminSupportNotificationData({ id: id(1) }),
  ])("denies anonymous and staff-only access before database operations: %#", async (operation) => {
    await expect(operation()).rejects.toThrow("Administrator access is required");
    sessions.staff = true;
    await expect(operation()).rejects.toThrow("Administrator access is required");
    expect(db.operations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paginates equal-time requests without duplicates and exposes a bounded summary", async () => {
    await handleSupportRequest(
      request(input(1, { message: "Long synthetic message. ".repeat(20) })),
    );
    await handleSupportRequest(request(input(2)));
    const timestamp = new Date().toISOString();
    for (const number of [1, 2])
      await db
        .collection("support_requests")
        .updateOne({ _id: id(number) }, { $set: { created_at: timestamp } });
    sessions.admin = true;
    const first = await getAdminSupportInboxData({ limit: 1 });
    expect(first.requests).toHaveLength(1);
    expect(first.requests[0]!.id).toBe(id(2));
    expect(first.nextCursor).toEqual({ createdAt: timestamp, id: id(2) });
    const second = await getAdminSupportInboxData({ limit: 1, before: first.nextCursor });
    expect(second.requests[0]!.id).toBe(id(1));
    expect(second.requests[0]!.messagePreview.length).toBeLessThanOrEqual(160);
    expect(second.nextCursor).toBeNull();
    expect(JSON.stringify(second.requests)).not.toContain("payload_hash");
  });

  it("saves a reply truthfully without configured email and prevents recipient mass assignment", async () => {
    await handleSupportRequest(request(input()));
    sessions.admin = true;
    expect(
      supportReplySchema.safeParse({
        id: id(1),
        replyId: id(99),
        message: "Synthetic staff reply.",
        email: "attacker@example.invalid",
      }).success,
    ).toBe(false);
    const reply = await replyAdminSupportRequestData({
      id: id(1),
      replyId: id(99),
      message: "Synthetic staff reply.",
    });
    expect(reply.reply.delivery).toBe("not_configured");
    expect(db.rows("support_requests")[0]!.reply_count).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a failed reply under one provider key and never resends a recorded success", async () => {
    configureMail();
    await handleSupportRequest(request(input()));
    fetchMock.mockClear();
    sessions.admin = true;
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Synthetic failure" }, { status: 500 }));
    const data = { id: id(1), replyId: id(99), message: "Synthetic staff reply." };
    expect((await replyAdminSupportRequestData(data)).reply.delivery).toBe("failed");
    expect((await replyAdminSupportRequestData(data)).reply.delivery).toBe("sent");
    expect((await replyAdminSupportRequestData(data)).reply.delivery).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map(([, options]) =>
      new Headers(options.headers).get("idempotency-key"),
    );
    expect(keys[0]).toBe(keys[1]);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).to).toEqual(["synthetic@example.invalid"]);
    expect(db.rows("support_replies")).toHaveLength(1);
    expect(db.rows("support_requests")[0]!.reply_count).toBe(1);
    await expect(
      replyAdminSupportRequestData({ ...data, message: "A changed synthetic staff reply." }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("scopes provider reply keys to both the ticket and reply identifier", async () => {
    configureMail();
    await handleSupportRequest(request(input(1)));
    await handleSupportRequest(request(input(2, { email: "second@example.invalid" })));
    fetchMock.mockClear();
    sessions.admin = true;
    for (const number of [1, 2])
      await replyAdminSupportRequestData({
        id: id(number),
        replyId: id(99),
        message: "Harmless synthetic reply shared across two fixtures.",
      });
    const keys = fetchMock.mock.calls.map(([, options]) =>
      new Headers(options.headers).get("idempotency-key"),
    );
    expect(new Set(keys).size).toBe(2);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).to[0])).toEqual([
      "synthetic@example.invalid",
      "second@example.invalid",
    ]);
  });

  it("retries a failed inbox notification without duplicating a successful delivery", async () => {
    configureMail();
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Synthetic failure" }, { status: 500 }));
    await handleSupportRequest(request(input()));
    const firstKey = new Headers(fetchMock.mock.calls[0]![1].headers).get("idempotency-key");
    expect(db.rows("support_requests")[0]!.notification_delivery).toBe("failed");
    fetchMock.mockClear();
    sessions.admin = true;
    expect((await retryAdminSupportNotificationData({ id: id(1) })).delivery).toBe("sent");
    expect((await retryAdminSupportNotificationData({ id: id(1) })).delivery).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("idempotency-key")).toBe(firstKey);
    expect(db.rows("support_requests")).toHaveLength(1);
  });

  it("limits reply creation and blocks replies to spam without sending mail", async () => {
    await handleSupportRequest(request(input()));
    sessions.admin = true;
    await db
      .collection("support_requests")
      .updateOne({ _id: id(1) }, { $set: { reply_count: 20 } });
    await expect(
      replyAdminSupportRequestData({
        id: id(1),
        replyId: id(99),
        message: "Synthetic excess reply.",
      }),
    ).rejects.toThrow("reply limit");
    expect(db.rows("support_replies")).toHaveLength(0);
    await setAdminSupportStatusData({ id: id(1), status: "spam" });
    await expect(
      replyAdminSupportRequestData({
        id: id(1),
        replyId: id(98),
        message: "Synthetic blocked reply.",
      }),
    ).rejects.toThrow("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
