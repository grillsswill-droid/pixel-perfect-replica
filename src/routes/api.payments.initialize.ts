import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";

import { PaymentConfigurationError } from "../lib/payment-types";
import {
  PaymentProviderError,
  PaymentRequestError,
  initializeFlutterwavePayment,
  initializeFlutterwavePaymentSchema,
  validatePublicSiteUrl,
} from "../lib/payments.server";

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === new URL(request.url).origin) return true;
  const publicOrigin =
    process.env["PUBLIC_SITE_URL"]?.trim() || process.env["APP_URL"]?.trim() || "";
  if (!publicOrigin) return false;
  try {
    return origin === validatePublicSiteUrl(publicOrigin);
  } catch {
    return false;
  }
}

export async function handleInitializePaymentRequest(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Invalid origin." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, error: "Send a JSON request body." }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 128_000) {
    return json({ ok: false, error: "The checkout request is too large." }, 413);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 128_000) {
      return json({ ok: false, error: "The checkout request is too large." }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return json({ ok: false, error: "The request body is not valid JSON." }, 400);
    }
    const input = initializeFlutterwavePaymentSchema.parse(body);
    const checkout = await initializeFlutterwavePayment(input);
    return json({ ok: true, ...checkout }, checkout.reused ? 200 : 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { ok: false, error: error.issues[0]?.message ?? "Check your payment details." },
        400,
      );
    }
    if (error instanceof PaymentRequestError) {
      return json({ ok: false, error: error.message }, 409);
    }
    if (error instanceof PaymentConfigurationError) {
      return json({ ok: false, error: "Flutterwave checkout is not configured yet." }, 503);
    }
    if (error instanceof PaymentProviderError) {
      console.error("Flutterwave checkout provider error", error.message);
      return json(
        { ok: false, error: "Flutterwave couldn't start checkout. Please try again." },
        502,
      );
    }
    console.error("Flutterwave initialization failed", error);
    return json({ ok: false, error: "We couldn't start payment. Please try again." }, 500);
  }
}

export const Route = createFileRoute("/api/payments/initialize")({
  server: {
    handlers: {
      POST: ({ request }) => handleInitializePaymentRequest(request),
    },
  },
});
