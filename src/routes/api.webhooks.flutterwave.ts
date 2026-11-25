import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PaymentConfigurationError, PaymentVerificationError } from "../lib/payment-types";
import {
  PaymentProviderError,
  claimFlutterwaveWebhookEvent,
  completeFlutterwaveWebhookEvent,
  failFlutterwaveWebhookEvent,
  verifyAndFinalizeFlutterwavePayment,
  verifyFlutterwaveWebhookHash,
} from "../lib/payments.server";

const webhookSchema = z
  .object({
    event: z.string().max(80),
    data: z
      .object({
        id: z.union([z.string(), z.number()]),
        tx_ref: z.string().max(200).optional(),
        status: z.string().max(40).optional(),
      })
      .passthrough(),
  })
  .passthrough();

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/webhooks/flutterwave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!verifyFlutterwaveWebhookHash(request.headers.get("verif-hash"))) {
            return json({ received: false, error: "Invalid webhook signature." }, 401);
          }
        } catch (error) {
          if (error instanceof PaymentConfigurationError) {
            return json({ received: false, error: "Webhook verification is not configured." }, 503);
          }
          throw error;
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 128_000) {
          return json({ received: false, error: "Webhook payload is too large." }, 413);
        }

        let payload: z.infer<typeof webhookSchema>;
        try {
          const rawBody = await request.text();
          if (rawBody.length > 128_000) {
            return json({ received: false, error: "Webhook payload is too large." }, 413);
          }
          payload = webhookSchema.parse(JSON.parse(rawBody) as unknown);
        } catch {
          return json({ received: false, error: "Invalid webhook payload." }, 400);
        }

        if (payload.event !== "charge.completed") {
          return json({ received: true, ignored: true });
        }

        const transactionId = String(payload.data.id);
        if (!/^\d+$/.test(transactionId)) {
          return json({ received: false, error: "Invalid transaction ID." }, 400);
        }
        const transactionStatus = payload.data.status?.trim().toLowerCase() ?? "";
        if (!transactionStatus) {
          return json({ received: false, error: "Missing transaction status." }, 400);
        }

        const claim = await claimFlutterwaveWebhookEvent({
          eventType: payload.event,
          transactionId,
          transactionStatus,
        });
        if (claim !== "claimed") {
          return json({ received: true, duplicate: true });
        }

        try {
          const result = await verifyAndFinalizeFlutterwavePayment({
            transactionId,
            expectedTxRef: payload.data.tx_ref ?? null,
          });
          await completeFlutterwaveWebhookEvent({
            eventType: payload.event,
            transactionId,
            transactionStatus,
            orderId: result.orderId,
          });
          return json({ received: true, verified: result.successful });
        } catch (error) {
          await failFlutterwaveWebhookEvent({
            eventType: payload.event,
            transactionId,
            transactionStatus,
            errorCode: error instanceof Error ? error.name : "unknown_error",
          });
          if (error instanceof PaymentVerificationError) {
            console.error("Flutterwave webhook verification rejected", error.message);
            return json({ received: true, verified: false });
          }
          if (error instanceof PaymentProviderError) {
            console.error("Flutterwave webhook provider verification failed", error.message);
            return json({ received: false, error: "Provider verification failed." }, 502);
          }
          console.error("Flutterwave webhook processing failed", error);
          return json({ received: false, error: "Webhook processing failed." }, 500);
        }
      },
    },
  },
});
