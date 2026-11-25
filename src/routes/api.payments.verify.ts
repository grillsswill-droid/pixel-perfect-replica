import { createFileRoute } from "@tanstack/react-router";

import { PaymentConfigurationError, PaymentVerificationError } from "../lib/payment-types";
import {
  PaymentProviderError,
  recordFlutterwaveCallbackStatus,
  verifyAndFinalizeFlutterwavePayment,
} from "../lib/payments.server";

function checkoutRedirect(
  request: Request,
  payment: "pending" | "cancelled" | "failed" | "verification_error",
) {
  const url = new URL("/checkout", request.url);
  url.searchParams.set("payment", payment);
  return new Response(null, { status: 303, headers: { location: url.toString() } });
}

export function callbackPaymentStatus(status: string): "pending" | "cancelled" | "failed" | null {
  if (status === "pending" || status === "processing") return "pending";
  if (status.includes("cancel") || status === "abandoned") return "cancelled";
  if (status) return "failed";
  return null;
}

export const Route = createFileRoute("/api/payments/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const callbackUrl = new URL(request.url);
        const transactionId = callbackUrl.searchParams.get("transaction_id")?.trim() ?? "";
        const status = callbackUrl.searchParams.get("status")?.trim().toLowerCase() ?? "";
        const txRef = callbackUrl.searchParams.get("tx_ref")?.trim() || null;
        const orderId = callbackUrl.searchParams.get("order_id")?.trim() || null;

        if (!transactionId) {
          const paymentStatus = callbackPaymentStatus(status);
          try {
            if (txRef && paymentStatus) {
              await recordFlutterwaveCallbackStatus({ txRef, orderId, status: paymentStatus });
            }
          } catch (error) {
            console.error("Flutterwave callback status update failed", error);
            return checkoutRedirect(request, "verification_error");
          }
          return checkoutRedirect(request, paymentStatus ?? "verification_error");
        }

        try {
          const result = await verifyAndFinalizeFlutterwavePayment({
            transactionId,
            expectedTxRef: txRef,
            expectedOrderId: orderId,
          });
          if (!result.successful) return checkoutRedirect(request, result.status);

          const orderUrl = new URL(`/orders/${result.orderId}`, request.url);
          orderUrl.searchParams.set("token", result.accessToken);
          orderUrl.searchParams.set("payment", "successful");
          return new Response(null, { status: 303, headers: { location: orderUrl.toString() } });
        } catch (error) {
          if (
            error instanceof PaymentVerificationError ||
            error instanceof PaymentProviderError ||
            error instanceof PaymentConfigurationError
          ) {
            console.error("Flutterwave callback verification failed", error.message);
            return checkoutRedirect(request, "verification_error");
          }
          console.error("Flutterwave callback failed", error);
          return checkoutRedirect(request, "verification_error");
        }
      },
    },
  },
});
