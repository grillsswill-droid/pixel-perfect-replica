import { createServerFn } from "@tanstack/react-start";
import {
  supportIdSchema,
  supportInboxSchema,
  supportReplySchema,
  supportStatusSchema,
} from "./support-types";

const SAFE_SUPPORT_ERRORS = new Set([
  "Administrator access is required.",
  "This support request is unavailable.",
  "The request changed in another session. Refresh and try again.",
  "This support request is unavailable for replies.",
  "Start a new reply after changing the message.",
  "This request has reached its reply limit.",
  "The reply changed. Refresh and try again.",
  "The reply could not be saved.",
  "The support status could not be saved.",
]);

function validated<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Check the support request details and try again.");
  return result.data;
}

async function safeOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("cache-control", "no-store");
    setResponseHeader("x-robots-tag", "noindex, nofollow");
    return await operation();
  } catch (error) {
    if (error instanceof Error && SAFE_SUPPORT_ERRORS.has(error.message)) {
      throw new Error(error.message);
    }
    console.warn("Support inbox operation unavailable.", { code: "support_operation_failed" });
    throw new Error("Support inbox is temporarily unavailable. Please try again.");
  }
}

export const getAdminSupportInbox = createServerFn({ method: "GET" })
  .validator((value: unknown) => validated(supportInboxSchema, value === undefined ? {} : value))
  .handler(async ({ data }) => {
    const { getAdminSupportInboxData } = await import("./support.server");
    return safeOperation(() => getAdminSupportInboxData(data));
  });

export const getAdminSupportRequest = createServerFn({ method: "GET" })
  .validator((value: unknown) => validated(supportIdSchema, value))
  .handler(async ({ data }) => {
    const { getAdminSupportRequestData } = await import("./support.server");
    return safeOperation(() => getAdminSupportRequestData(data));
  });

export const setAdminSupportStatus = createServerFn({ method: "POST" })
  .validator((value: unknown) => validated(supportStatusSchema, value))
  .handler(async ({ data }) => {
    const { setAdminSupportStatusData } = await import("./support.server");
    return safeOperation(() => setAdminSupportStatusData(data));
  });

export const replyAdminSupportRequest = createServerFn({ method: "POST" })
  .validator((value: unknown) => validated(supportReplySchema, value))
  .handler(async ({ data }) => {
    const { replyAdminSupportRequestData } = await import("./support.server");
    return safeOperation(() => replyAdminSupportRequestData(data));
  });

export const retryAdminSupportNotification = createServerFn({ method: "POST" })
  .validator((value: unknown) => validated(supportIdSchema, value))
  .handler(async ({ data }) => {
    const { retryAdminSupportNotificationData } = await import("./support.server");
    return safeOperation(() => retryAdminSupportNotificationData(data));
  });
