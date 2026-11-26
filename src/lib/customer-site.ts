export const DEFAULT_SUPPORT_EMAIL = "grillsswill@gmail.com";
export const BUSINESS_NAME = "Grill & Swill";

export type CustomerSiteConfiguration = {
  supportEmail: string;
  inboxEnabled: boolean;
  emailDeliveryEnabled: boolean;
  businessName: string;
  operatingRegions: string;
  legalBusinessName: string | null;
  businessAddress: string | null;
  jurisdiction: string | null;
  supportHours: string | null;
};

export const DEFAULT_CUSTOMER_CONFIGURATION: CustomerSiteConfiguration = {
  supportEmail: DEFAULT_SUPPORT_EMAIL,
  inboxEnabled: false,
  emailDeliveryEnabled: false,
  businessName: BUSINESS_NAME,
  operatingRegions: "Worldwide",
  legalBusinessName: null,
  businessAddress: null,
  jurisdiction: null,
  supportHours: null,
};

export const CUSTOMER_POLICY_LINKS = [
  { path: "/privacy", label: "Privacy notice" },
  { path: "/terms", label: "Terms of service" },
  { path: "/refund-policy", label: "Cancellations & refunds" },
  { path: "/delivery-policy", label: "Delivery & pickup" },
  { path: "/allergens", label: "Food & allergens" },
  { path: "/cookies", label: "Cookies & browser storage" },
  { path: "/accessibility", label: "Accessibility" },
] as const;

export function customerPolicyLinks(hasLocations: boolean) {
  return CUSTOMER_POLICY_LINKS.map((link) => ({
    ...link,
    label: link.path === "/delivery-policy" && !hasLocations ? "Delivery" : link.label,
  }));
}

export function supportMailto(email: string, subject = "Grill & Swill support"): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
