import { createHmac, timingSafeEqual } from "node:crypto";

function getSigningSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export function createOrderAccessToken(orderId: string, guestId: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(`grill-swill:order:${orderId}:${guestId}`)
    .digest("base64url");
}

export function verifyOrderAccessToken(token: string, orderId: string, guestId: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const expected = Buffer.from(createOrderAccessToken(orderId, guestId), "base64url");
  const candidate = Buffer.from(token, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
