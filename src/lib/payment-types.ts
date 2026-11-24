import { z } from "zod";

export const paymentProviderSchema = z.enum(["stripe", "paypal", "flutterwave"]);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentStatusSchema = z.enum([
  "not_charged",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export interface PublicPaymentProvider {
  id: PaymentProvider;
  label: string;
  description: string;
  available: boolean;
  testMode: boolean;
}

export interface ProviderCheckout {
  provider: PaymentProvider;
  reference: string;
  checkoutUrl: string;
  expiresAt?: string;
}

export interface ProviderPaymentOutcome {
  provider: PaymentProvider;
  providerReference: string;
  status: Extract<PaymentStatus, "pending" | "processing" | "paid" | "failed" | "cancelled">;
  amountCents?: number;
  currency?: string;
  transactionId?: string;
  paymentMethod?: string;
  last4?: string;
  failureCode?: string;
}

export interface ProviderRefundOutcome {
  provider: PaymentProvider;
  refundId: string;
  amountCents: number;
  status: "pending" | "succeeded" | "failed";
}

export class PaymentConfigurationError extends Error {
  override name = "PaymentConfigurationError";
}

export class PaymentVerificationError extends Error {
  override name = "PaymentVerificationError";
}

export function decimalToCents(value: string | number): number {
  const normalized = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new PaymentVerificationError("The provider returned an invalid payment amount.");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new PaymentVerificationError("Payment amounts must be non-negative integer cents.");
  }
  return (cents / 100).toFixed(2);
}

export function normalizedCurrency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}
