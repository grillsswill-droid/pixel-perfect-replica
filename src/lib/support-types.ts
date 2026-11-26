import { z } from "zod";

/* eslint-disable no-control-regex -- Input validation intentionally rejects control characters. */

export const SUPPORT_TOPICS = [
  "order_issue",
  "payment",
  "cancellation_refund",
  "delivery_pickup",
  "food_allergy",
  "rewards",
  "catering",
  "privacy",
  "accessibility",
  "website",
  "other",
] as const;

export const SUPPORT_STATUSES = ["new", "in_progress", "resolved", "spam"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export type SupportDelivery = "not_configured" | "queued" | "sending" | "sent" | "failed";

const singleLine = (label: string, minimum: number, maximum: number) =>
  z
    .string({ required_error: `Enter ${label}.`, invalid_type_error: `Enter ${label} as text.` })
    .trim()
    .min(minimum, `Enter ${label} with at least ${minimum} characters.`)
    .max(maximum, `Keep ${label} within ${maximum} characters.`)
    .regex(/^[^\u0000-\u001f\u007f]*$/, `Use a single line of text for ${label}.`);
const messageSchema = z
  .string({
    required_error: "Enter your message.",
    invalid_type_error: "Enter your message as text.",
  })
  .trim()
  .min(10, "Tell us what happened in at least 10 characters.")
  .max(4000, "Keep your message within 4,000 characters.")
  .refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
    "Remove unsupported characters from your message.",
  );

export const supportRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    name: singleLine("your name", 2, 80),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address, such as name@example.com.")
      .max(254, "Keep your email address within 254 characters.")
      .transform((value) => value.toLowerCase()),
    subject: singleLine("a subject", 3, 160),
    message: messageSchema,
    topic: z.enum(SUPPORT_TOPICS),
    orderReference: singleLine("the order reference", 0, 80).optional().default(""),
  })
  .strict();

export type SupportRequestInput = z.input<typeof supportRequestSchema>;
export type ParsedSupportRequest = z.output<typeof supportRequestSchema>;

export const supportInboxCursorSchema = z
  .object({ createdAt: z.string().datetime(), id: z.string().uuid() })
  .strict();
export type SupportInboxCursor = z.infer<typeof supportInboxCursorSchema>;

export const supportInboxSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    limit: z.number().int().min(1).max(50).optional().default(25),
    before: supportInboxCursorSchema.optional(),
  })
  .strict();

export const supportIdSchema = z.object({ id: z.string().uuid() }).strict();
export const supportStatusSchema = z
  .object({ id: z.string().uuid(), status: z.enum(SUPPORT_STATUSES) })
  .strict();
export const supportReplySchema = z
  .object({ id: z.string().uuid(), replyId: z.string().uuid(), message: messageSchema })
  .strict();

export type SupportRequestSummary = {
  id: string;
  reference: string;
  name: string;
  email: string;
  subject: string;
  topic: SupportTopic;
  status: SupportStatus;
  orderReference: string | null;
  messagePreview: string;
  notificationDelivery: SupportDelivery;
  createdAt: string;
  updatedAt: string;
};

export type SupportReply = {
  id: string;
  message: string;
  delivery: SupportDelivery;
  deliveryCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportRequestDetail = SupportRequestSummary & {
  message: string;
  replies: SupportReply[];
};

export type SupportInboxResult = {
  requests: SupportRequestSummary[];
  nextCursor: SupportInboxCursor | null;
  emailDeliveryEnabled: boolean;
};
