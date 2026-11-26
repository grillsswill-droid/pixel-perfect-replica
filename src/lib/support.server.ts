import { createHash, createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { ClientSession, Db, Document } from "mongodb";
import { z } from "zod";

import { DEFAULT_SUPPORT_EMAIL } from "./customer-site";
import { parsePublicSiteOrigin } from "./seo.server";
import { loadLocalServerEnvironment } from "./server-environment.server";
import {
  supportIdSchema,
  supportInboxSchema,
  supportReplySchema,
  supportRequestSchema,
  supportStatusSchema,
  type ParsedSupportRequest,
  type SupportDelivery,
  type SupportInboxResult,
  type SupportReply,
  type SupportRequestDetail,
  type SupportRequestSummary,
  type SupportStatus,
  type SupportTopic,
} from "./support-types";

const REQUEST_BYTE_LIMIT = 32_768;
const BODY_TIMEOUT_MS = 10_000;
const MAIL_TIMEOUT_MS = 8_000;
const DELIVERY_LEASE_MS = 2 * 60_000;
const PROVIDER_IDEMPOTENCY_MS = 24 * 60 * 60_000;
const MAX_DELIVERY_ATTEMPTS = 3;
const MAX_REPLIES = 20;

type SupportDocument = Document & {
  _id: string;
  reference: string;
  payload_hash: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  topic: SupportTopic;
  order_reference: string | null;
  status: SupportStatus;
  notification_delivery: SupportDelivery;
  notification_attempts: number;
  notification_lease?: string;
  notification_started_at?: string;
  notification_first_attempt_at?: string;
  notification_error_code?: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
};

type ReplyDocument = Document & {
  _id: string;
  id: string;
  request_id: string;
  message: string;
  delivery: SupportDelivery;
  delivery_attempts: number;
  delivery_lease?: string;
  delivery_started_at?: string;
  delivery_first_attempt_at?: string;
  delivery_code?: string | null;
  created_at: string;
  updated_at: string;
};

type RateDocument = Document & {
  _id: string;
  count: number;
  window_start: number;
  expires_at: string;
};
type Quota = { key: string; duration: number; maximum: number };
type MailConfiguration = { key: string; from: string; inbox: string };
type MailResult = { delivered: boolean; code: string | null };

class SupportError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

const configuredEmail = z.string().trim().email().max(254);

export function isSupportInboxConfigured(): boolean {
  loadLocalServerEnvironment();
  return Boolean(
    process.env["MONGODB_URI"]?.trim() && (process.env["SESSION_SECRET"]?.length ?? 0) >= 32,
  );
}

function getMailConfiguration(): MailConfiguration | null {
  loadLocalServerEnvironment();
  const inbox = configuredEmail.safeParse(
    process.env["SUPPORT_EMAIL"]?.trim() || DEFAULT_SUPPORT_EMAIL,
  );
  const from = configuredEmail.safeParse(process.env["SUPPORT_FROM_EMAIL"]);
  const key = process.env["RESEND_API_KEY"]?.trim();
  if (
    !inbox.success ||
    !from.success ||
    /@(gmail|googlemail)\.com$/i.test(from.data) ||
    !key ||
    !/^re_[A-Za-z0-9_-]{1,256}$/.test(key)
  ) {
    return null;
  }
  return { inbox: inbox.data, from: from.data, key };
}

export function isSupportEmailDeliveryConfigured(): boolean {
  return getMailConfiguration() !== null;
}

function rateSecret(): string {
  loadLocalServerEnvironment();
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32 || !process.env["MONGODB_URI"]?.trim()) {
    throw new SupportError(503, "We couldn't save your message. Please try again.", 60);
  }
  return secret;
}

async function database() {
  const { getMongoDatabase } = await import("./mongodb.server");
  return getMongoDatabase();
}

async function requireSupportAdmin() {
  const { requireAdmin } = await import("./admin.functions");
  await requireAdmin();
}

function json(body: unknown, status = 200, retryAfter?: number): Response {
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  };
  if (retryAfter !== undefined) headers["retry-after"] = String(retryAfter);
  return Response.json(body, { status, headers });
}

function isAllowedOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return (
    origin === new URL(request.url).origin ||
    origin === parsePublicSiteOrigin(process.env["PUBLIC_SITE_URL"])
  );
}

async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  timeoutMs = BODY_TIMEOUT_MS,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  const parts: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new SupportError(408, "The request took too long. Please try again.")),
      timeoutMs,
    );
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit)
        throw new SupportError(413, "Your message is too large. Shorten it and try again.");
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    try {
      reader.releaseLock();
    } catch {
      // Cancellation also terminates an outstanding read after a body timeout.
    }
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    throw new SupportError(400, "Check the required fields and try again.");
  }
  if (declared !== null && Number(declared) > REQUEST_BYTE_LIMIT) {
    void request.body?.cancel().catch(() => undefined);
    throw new SupportError(413, "Your message is too large. Shorten it and try again.");
  }

  return JSON.parse(await readBoundedText(request.body, REQUEST_BYTE_LIMIT)) as unknown;
}

function trustedClientIp(request: Request): string | null {
  // Enable only when the operator's trusted proxy replaces the selected header.
  const header = process.env["SUPPORT_TRUSTED_IP_HEADER"]?.trim().toLowerCase();
  if (!header || !["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for"].includes(header)) {
    return null;
  }
  const candidate = request.headers.get(header)?.split(",", 1)[0]?.trim();
  return candidate && candidate.length <= 64 && isIP(candidate) ? candidate : null;
}

function quotasFor(request: Request, email: string, secret: string): Quota[] {
  const opaque = (purpose: string, value: string) =>
    createHmac("sha256", secret).update(`support:${purpose}:${value}`).digest("hex");
  const quotas: Quota[] = [
    { key: "global-minute", duration: 60_000, maximum: 30 },
    { key: `email:${opaque("email", email)}`, duration: 60 * 60_000, maximum: 3 },
  ];
  const ip = trustedClientIp(request);
  if (ip) quotas.push({ key: `network:${opaque("ip", ip)}`, duration: 15 * 60_000, maximum: 5 });
  return quotas;
}

async function reserveQuota(db: Db, quota: Quota, now: number, session: ClientSession) {
  const counters = db.collection<RateDocument>("support_rate_limits");
  const windowStart = Math.floor(now / quota.duration) * quota.duration;
  const current = await counters.findOne({ _id: quota.key }, { session });
  if (current?.window_start === windowStart) {
    await counters.updateOne(
      { _id: quota.key, window_start: windowStart },
      { $inc: { count: 1 } },
      { session },
    );
  } else {
    await counters.updateOne(
      { _id: quota.key },
      {
        $set: {
          window_start: windowStart,
          count: 1,
          expires_at: new Date(windowStart + quota.duration).toISOString(),
        },
      },
      { upsert: true, session },
    );
  }
  const updated = await counters.findOne({ _id: quota.key }, { session });
  if (!updated || updated.count > quota.maximum) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + quota.duration - now) / 1000));
    throw new SupportError(429, "Too many requests. Please wait and try again.", retryAfter);
  }
}

function payloadHash(data: ParsedSupportRequest): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

async function persistSupportRequest(request: Request, data: ParsedSupportRequest) {
  const secret = rateSecret();
  const { client, db } = await database();
  const records = db.collection<SupportDocument>("support_requests");
  const hash = payloadHash(data);
  const checkDuplicate = (existing: SupportDocument) => {
    if (existing.payload_hash !== hash) {
      throw new SupportError(409, "Please start a new support request and try again.");
    }
    return { record: existing, created: false };
  };
  const existing = await records.findOne({ _id: data.requestId });
  if (existing) return { ...checkDuplicate(existing), db };

  // MongoDB's _id constraint protects both request and quota identity. No schema DDL is run.
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = client.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const duplicate = await records.findOne({ _id: data.requestId }, { session });
        if (duplicate) return checkDuplicate(duplicate);
        const now = Date.now();
        for (const quota of quotasFor(request, data.email, secret)) {
          await reserveQuota(db, quota, now, session);
        }
        const timestamp = new Date(now).toISOString();
        const record: SupportDocument = {
          _id: data.requestId,
          reference: `GS-${data.requestId.toUpperCase()}`,
          payload_hash: hash,
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
          topic: data.topic,
          order_reference: data.orderReference || null,
          status: "new",
          notification_delivery: isSupportEmailDeliveryConfigured() ? "queued" : "not_configured",
          notification_attempts: 0,
          reply_count: 0,
          created_at: timestamp,
          updated_at: timestamp,
        };
        await records.insertOne(record, { session });
        return { record, created: true };
      });
      if (!result)
        throw new SupportError(503, "We couldn't save your message. Please try again.", 60);
      return { ...result, db };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const duplicate = await records.findOne({ _id: data.requestId });
      if (duplicate) return { ...checkDuplicate(duplicate), db };
      if (attempt === 2)
        throw new SupportError(503, "We couldn't save your message. Please try again.", 60);
    } finally {
      await session.endSession();
    }
  }
  throw new SupportError(503, "We couldn't save your message. Please try again.", 60);
}

async function sendMail(
  configuration: MailConfiguration,
  recipient: string,
  replyTo: string,
  subject: string,
  text: string,
  idempotencyKey: string,
): Promise<MailResult> {
  const destination = configuredEmail.safeParse(recipient);
  const returnAddress = configuredEmail.safeParse(replyTo);
  if (!destination.success || !returnAddress.success) {
    return { delivered: false, code: "invalid_recipient" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${configuration.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
      body: JSON.stringify({
        from: configuration.from,
        to: [destination.data],
        reply_to: returnAddress.data,
        subject,
        text,
      }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return { delivered: false, code: "provider_rejected" };
    }
    const payload = JSON.parse(await readBoundedText(response.body, 16_384, MAIL_TIMEOUT_MS)) as {
      id?: unknown;
    };
    if (typeof payload.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(payload.id)) {
      return { delivered: false, code: "invalid_provider_response" };
    }
    return { delivered: true, code: null };
  } catch (error) {
    const name = (error as { name?: string }).name;
    return {
      delivered: false,
      code:
        name === "AbortError" ||
        name === "TimeoutError" ||
        (error instanceof SupportError && error.status === 408)
          ? "timeout"
          : "provider_unavailable",
    };
  }
}

async function notifySupportInbox(db: Db, record: SupportDocument): Promise<SupportDelivery> {
  const configuration = getMailConfiguration();
  if (!configuration || record.status === "spam") return record.notification_delivery;
  const records = db.collection<SupportDocument>("support_requests");
  const current = await records.findOne({ _id: record._id });
  if (!current || current.notification_delivery === "sent")
    return current?.notification_delivery ?? "failed";
  const now = Date.now();
  if (
    current.notification_first_attempt_at &&
    now - Date.parse(current.notification_first_attempt_at) >= PROVIDER_IDEMPOTENCY_MS
  ) {
    await records.updateOne(
      { _id: record._id },
      { $set: { notification_delivery: "failed", notification_error_code: "manual_review" } },
    );
    return "failed";
  }
  const lease = randomUUID();
  const timestamp = new Date(now).toISOString();
  const claimed = await records.updateOne(
    {
      _id: record._id,
      status: { $ne: "spam" },
      notification_attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
      $or: [
        { notification_delivery: { $in: ["queued", "failed", "not_configured"] } },
        {
          notification_delivery: "sending",
          notification_started_at: { $lte: new Date(now - DELIVERY_LEASE_MS).toISOString() },
        },
      ],
    },
    {
      $set: {
        notification_delivery: "sending",
        notification_lease: lease,
        notification_started_at: timestamp,
        notification_first_attempt_at: current.notification_first_attempt_at ?? timestamp,
      },
      $inc: { notification_attempts: 1 },
    },
  );
  if (!claimed.modifiedCount) return current.notification_delivery;
  const text = [
    `Support reference: ${record.reference}`,
    `Topic: ${record.topic}`,
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    `Subject: ${record.subject}`,
    record.order_reference
      ? `Order reference supplied by the customer: ${record.order_reference}`
      : "",
    "",
    record.message,
  ].join("\n");
  const result = await sendMail(
    configuration,
    configuration.inbox,
    record.email,
    `Grill & Swill support: ${record.reference}`,
    text,
    `support-notification-${record._id}`,
  );
  const delivery: SupportDelivery = result.delivered ? "sent" : "failed";
  await records.updateOne(
    { _id: record._id, notification_lease: lease },
    {
      $set: { notification_delivery: delivery, notification_error_code: result.code },
      $unset: { notification_lease: "" },
    },
  );
  return delivery;
}

/** Public submissions return an acknowledgement, never a customer or inbox lookup. */
export async function handleSupportRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    const response = json({ ok: false, error: "Use POST to send a support request." }, 405);
    response.headers.set("allow", "POST");
    return response;
  }
  if (!isAllowedOrigin(request)) return json({ ok: false, error: "Invalid request origin." }, 403);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json")
    return json({ ok: false, error: "Send a JSON request body." }, 415);
  let data: ParsedSupportRequest;
  try {
    data = supportRequestSchema.parse(await readRequestBody(request));
  } catch (error) {
    if (error instanceof SupportError)
      return json({ ok: false, error: error.message }, error.status, error.retryAfter);
    return json({ ok: false, error: "Check the required fields and try again." }, 400);
  }
  try {
    const result = await persistSupportRequest(request, data);
    if (result.created) {
      try {
        await notifySupportInbox(result.db, result.record);
      } catch {
        // The request is durable even when notification state cannot be updated.
        console.warn("Support notification needs review.", { code: "notification_update_failed" });
      }
    }
    return json({ ok: true, reference: result.record.reference }, 202);
  } catch (error) {
    if (error instanceof SupportError)
      return json({ ok: false, error: error.message }, error.status, error.retryAfter);
    console.warn("Support submission unavailable.", { code: "storage_unavailable" });
    return json({ ok: false, error: "We couldn't save your message. Please try again." }, 503, 60);
  }
}

function summary(record: SupportDocument): SupportRequestSummary {
  return {
    id: record._id,
    reference: record.reference,
    name: record.name,
    email: record.email,
    subject: record.subject,
    topic: record.topic,
    status: record.status,
    orderReference: record.order_reference,
    messagePreview: record.message.slice(0, 160),
    notificationDelivery: record.notification_delivery,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function replyDto(record: ReplyDocument): SupportReply {
  return {
    id: record.id,
    message: record.message,
    delivery: record.delivery,
    deliveryCode: record.delivery_code ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function logAdminAction(
  db: Db,
  action: string,
  details: Record<string, string>,
  session?: ClientSession,
) {
  await db
    .collection("admin_logs")
    .insertOne(
      { id: randomUUID(), admin_id: null, action, details, created_at: new Date().toISOString() },
      { session },
    );
}

export async function getAdminSupportInboxData(input: unknown): Promise<SupportInboxResult> {
  await requireSupportAdmin();
  const data = supportInboxSchema.parse(input === undefined ? {} : input);
  const { db } = await database();
  const query: Document = data.status ? { status: data.status } : {};
  if (data.before) {
    query.$or = [
      { created_at: { $lt: data.before.createdAt } },
      { created_at: data.before.createdAt, _id: { $lt: data.before.id } },
    ];
  }
  const records = await db
    .collection<SupportDocument>("support_requests")
    .find(query)
    .sort({ created_at: -1, _id: -1 })
    .limit(data.limit + 1)
    .toArray();
  const selected = records.slice(0, data.limit);
  const last = selected[selected.length - 1];
  return {
    requests: selected.map(summary),
    nextCursor:
      records.length > data.limit && last ? { createdAt: last.created_at, id: last._id } : null,
    emailDeliveryEnabled: isSupportEmailDeliveryConfigured(),
  };
}

export async function getAdminSupportRequestData(input: unknown) {
  await requireSupportAdmin();
  const data = supportIdSchema.parse(input);
  const { db } = await database();
  const record = await db.collection<SupportDocument>("support_requests").findOne({ _id: data.id });
  if (!record) return { request: null, emailDeliveryEnabled: isSupportEmailDeliveryConfigured() };
  const replies = await db
    .collection<ReplyDocument>("support_replies")
    .find({ request_id: data.id })
    .sort({ created_at: 1 })
    .limit(MAX_REPLIES)
    .toArray();
  const detail: SupportRequestDetail = {
    ...summary(record),
    message: record.message,
    replies: replies.map(replyDto),
  };
  return { request: detail, emailDeliveryEnabled: isSupportEmailDeliveryConfigured() };
}

export async function setAdminSupportStatusData(input: unknown) {
  await requireSupportAdmin();
  const data = supportStatusSchema.parse(input);
  const { client, db } = await database();
  const records = db.collection<SupportDocument>("support_requests");
  const session = client.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const record = await records.findOne({ _id: data.id }, { session });
      if (!record) throw new Error("This support request is unavailable.");
      if (record.status === data.status)
        return { ok: true as const, status: data.status, updatedAt: record.updated_at };
      const updatedAt = new Date().toISOString();
      const update = await records.updateOne(
        { _id: data.id, status: record.status, updated_at: record.updated_at },
        { $set: { status: data.status, updated_at: updatedAt } },
        { session },
      );
      if (!update.modifiedCount)
        throw new Error("The request changed in another session. Refresh and try again.");
      await logAdminAction(
        db,
        "support_status",
        { request_id: data.id, status: data.status },
        session,
      );
      return { ok: true as const, status: data.status, updatedAt };
    });
    if (!result) throw new Error("The support status could not be saved.");
    return result;
  } finally {
    await session.endSession();
  }
}

export async function retryAdminSupportNotificationData(input: unknown) {
  await requireSupportAdmin();
  const data = supportIdSchema.parse(input);
  const { db } = await database();
  const record = await db.collection<SupportDocument>("support_requests").findOne({ _id: data.id });
  if (!record || record.status === "spam") throw new Error("This support request is unavailable.");
  const delivery = await notifySupportInbox(db, record);
  await logAdminAction(db, "support_notification_retry", { request_id: data.id, delivery });
  return { ok: true as const, delivery };
}

async function deliverReply(
  db: Db,
  request: SupportDocument,
  reply: ReplyDocument,
): Promise<ReplyDocument> {
  const records = db.collection<ReplyDocument>("support_replies");
  const current = await records.findOne({ _id: reply._id });
  if (!current || current.delivery === "sent") return current ?? reply;
  const configuration = getMailConfiguration();
  if (!configuration) return current;
  const activeRequest = await db
    .collection<SupportDocument>("support_requests")
    .findOne({ _id: request._id });
  if (!activeRequest || activeRequest.status === "spam") {
    await records.updateOne(
      { _id: current._id },
      { $set: { delivery: "failed", delivery_code: "request_moderated" } },
    );
    return (await records.findOne({ _id: current._id })) ?? current;
  }
  const now = Date.now();
  if (
    current.delivery_first_attempt_at &&
    now - Date.parse(current.delivery_first_attempt_at) >= PROVIDER_IDEMPOTENCY_MS
  ) {
    await records.updateOne(
      { _id: current._id },
      { $set: { delivery: "failed", delivery_code: "manual_review" } },
    );
    return (await records.findOne({ _id: current._id })) ?? current;
  }
  const lease = randomUUID();
  const timestamp = new Date(now).toISOString();
  const claimed = await records.updateOne(
    {
      _id: reply._id,
      delivery_attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
      $or: [
        { delivery: { $in: ["queued", "failed", "not_configured"] } },
        {
          delivery: "sending",
          delivery_started_at: { $lte: new Date(now - DELIVERY_LEASE_MS).toISOString() },
        },
      ],
    },
    {
      $set: {
        delivery: "sending",
        delivery_lease: lease,
        delivery_started_at: timestamp,
        delivery_first_attempt_at: current.delivery_first_attempt_at ?? timestamp,
        updated_at: timestamp,
      },
      $inc: { delivery_attempts: 1 },
    },
  );
  if (!claimed.modifiedCount) return current;
  const result = await sendMail(
    configuration,
    request.email,
    configuration.inbox,
    `Grill & Swill support: ${request.reference}`,
    `${reply.message}\n\nSupport reference: ${request.reference}`,
    `support-reply-${request._id}-${reply.id}`,
  );
  const delivery: SupportDelivery = result.delivered ? "sent" : "failed";
  await records.updateOne(
    { _id: reply._id, delivery_lease: lease },
    {
      $set: { delivery, delivery_code: result.code, updated_at: new Date().toISOString() },
      $unset: { delivery_lease: "" },
    },
  );
  await logAdminAction(db, "support_reply_delivery", {
    request_id: request._id,
    reply_id: reply.id,
    delivery,
  });
  return (await records.findOne({ _id: reply._id })) ?? current;
}

export async function replyAdminSupportRequestData(input: unknown) {
  await requireSupportAdmin();
  const data = supportReplySchema.parse(input);
  const { client, db } = await database();
  const requests = db.collection<SupportDocument>("support_requests");
  const replies = db.collection<ReplyDocument>("support_replies");
  const key = `${data.id}:${data.replyId}`;
  const session = client.startSession();
  let request: SupportDocument | null = null;
  let reply: ReplyDocument | null = null;
  try {
    await session.withTransaction(async () => {
      request = await requests.findOne({ _id: data.id }, { session });
      if (!request || request.status === "spam")
        throw new Error("This support request is unavailable for replies.");
      reply = await replies.findOne({ _id: key }, { session });
      if (reply) {
        if (reply.message !== data.message)
          throw new Error("Start a new reply after changing the message.");
        return;
      }
      if ((await replies.countDocuments({ request_id: data.id }, { session })) >= MAX_REPLIES)
        throw new Error("This request has reached its reply limit.");
      const now = new Date().toISOString();
      reply = {
        _id: key,
        id: data.replyId,
        request_id: data.id,
        message: data.message,
        delivery: isSupportEmailDeliveryConfigured() ? "queued" : "not_configured",
        delivery_attempts: 0,
        created_at: now,
        updated_at: now,
      };
      // Increment the parent so concurrent reply reservations conflict and retry atomically.
      const reserved = await requests.updateOne(
        {
          _id: data.id,
          $or: [{ reply_count: { $exists: false } }, { reply_count: { $lt: MAX_REPLIES } }],
        },
        { $set: { updated_at: now }, $inc: { reply_count: 1 } },
        { session },
      );
      if (!reserved.modifiedCount) throw new Error("This request has reached its reply limit.");
      await replies.insertOne(reply, { session });
      await db.collection("admin_logs").insertOne(
        {
          id: randomUUID(),
          admin_id: null,
          action: "support_reply_saved",
          details: { request_id: data.id, reply_id: data.replyId },
          created_at: now,
        },
        { session },
      );
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    request = await requests.findOne({ _id: data.id });
    reply = await replies.findOne({ _id: key });
    if (!request || !reply || reply.message !== data.message)
      throw new Error("The reply changed. Refresh and try again.");
  } finally {
    await session.endSession();
  }
  if (!request || !reply) throw new Error("The reply could not be saved.");
  const delivered = await deliverReply(db, request, reply);
  return { ok: true as const, reply: replyDto(delivered) };
}
