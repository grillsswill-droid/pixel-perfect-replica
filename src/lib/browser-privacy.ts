export const MAP_PREFERENCE_KEY = "grill-swill-external-maps-v1";

export const CUSTOMER_LOCAL_STORAGE_KEYS = [
  "grill-swill-guest-id",
  "grill-swill-cart-v1",
  "grill-swill-address-v1",
  "grill-swill-contact-v1",
  MAP_PREFERENCE_KEY,
] as const;

export const CUSTOMER_SESSION_STORAGE_KEYS = ["grill-swill-checkout-request-v1"] as const;

/** A customer action, scoped to this application's device data, never server records. */
export function clearCustomerBrowserData(local: Storage, session: Storage): void {
  for (const key of CUSTOMER_LOCAL_STORAGE_KEYS) local.removeItem(key);
  for (const key of CUSTOMER_SESSION_STORAGE_KEYS) session.removeItem(key);
}
