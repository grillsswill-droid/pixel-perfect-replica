import type { MetaHTMLAttributes } from "react";

import shareImage from "@/assets/hero-feast.jpg";

export type SeoConfiguration = {
  origin: string | null;
  indexable: boolean;
  googleSiteVerification: string | null;
  hasLocations?: boolean;
};

export const NOINDEX = "noindex, nofollow";
export const INDEXABLE = "index, follow, max-image-preview:large";

// Public marketing and customer information pages belong in search.
// Rewards, support records and other account data stay private.
export const PUBLIC_SEO_PAGES = [
  {
    path: "/",
    label: "Home",
    title: "Grill & Swill | Fast food, made the slow way",
    description:
      "Smash burgers, crispy chicken, wood-fired pizza and cold brew. Explore the Grill & Swill menu and order pickup or delivery.",
  },
  {
    path: "/menu",
    label: "Menu",
    title: "Menu: Burgers, Pizza & Combos | Grill & Swill",
    description:
      "Browse Grill & Swill burgers, chicken, pizza, combo meals, kids' meals, desserts and drinks. Customize your order for pickup or delivery.",
  },
  {
    path: "/deals",
    label: "Deals",
    title: "Deals & Promo Codes | Grill & Swill",
    description:
      "Browse current Grill & Swill deals and promo codes. Check offer details, explore the menu and order your favourites for pickup or delivery.",
  },
  {
    path: "/catering",
    label: "Catering",
    title: "Catering for Parties & Groups | Grill & Swill",
    description:
      "Explore Grill & Swill catering packages for parties and group gatherings. Choose food and protein add-ons, then send an inquiry for your event.",
  },
  {
    path: "/gallery",
    label: "Gallery",
    title: "Food & Restaurant Gallery | Grill & Swill",
    description:
      "Explore photos from Grill & Swill, including food, combo meals, packaging and moments fresh from the grill. Find inspiration for your next order.",
  },
  {
    path: "/locations",
    label: "Locations",
    title: "Locations & Opening Hours | Grill & Swill",
    description:
      "Find Grill & Swill store addresses, opening hours and contact details. Choose a location for your next pickup or delivery order.",
  },
  {
    path: "/faq",
    label: "FAQs",
    title: "Frequently Asked Questions | Grill & Swill",
    description:
      "Find answers about Grill & Swill ordering, payment, delivery, cancellations, refunds, allergens, rewards and customer support.",
  },
  {
    path: "/support",
    label: "Customer support",
    title: "Contact Customer Support | Grill & Swill",
    description:
      "Contact Grill & Swill for help with an order, payment, refund request, catering inquiry, accessibility concern or website problem.",
  },
  {
    path: "/privacy",
    label: "Privacy notice",
    title: "Privacy Notice | Grill & Swill",
    description:
      "How Grill & Swill uses order, contact, browser and support information, and how to ask about your data.",
  },
  {
    path: "/terms",
    label: "Terms of use",
    title: "Terms of Use & Ordering | Grill & Swill",
    description:
      "Read the Grill & Swill terms for guest orders, payments, promotions, rewards, catering and public comments.",
  },
  {
    path: "/refund-policy",
    label: "Cancellations and refunds",
    title: "Cancellation & Refund Policy | Grill & Swill",
    description:
      "Learn how to request an order change, cancellation or review of a Grill & Swill charge, missing item or food-quality problem.",
  },
  {
    path: "/delivery-policy",
    label: "Delivery information",
    title: "Delivery & Collection Information | Grill & Swill",
    description:
      "Read about Grill & Swill fulfillment availability, delivery details, order estimates and getting help with your order.",
  },
  {
    path: "/allergens",
    label: "Food and allergens",
    title: "Food & Allergen Information | Grill & Swill",
    description:
      "Read Grill & Swill guidance on food allergies, ingredients, cross-contact and asking about dietary needs before ordering.",
  },
  {
    path: "/cookies",
    label: "Cookies and browser storage",
    title: "Cookies & Browser Storage | Grill & Swill",
    description:
      "Learn what Grill & Swill remembers in your browser, manage external map preferences and clear saved site data on your device.",
  },
  {
    path: "/accessibility",
    label: "Accessibility",
    title: "Accessibility Statement | Grill & Swill",
    description:
      "Read the Grill & Swill accessibility aims and available features, request help or report a barrier using customer support.",
  },
] as const;

export function seoFromMatches(matches: ReadonlyArray<{ loaderData?: unknown }>): SeoConfiguration {
  const data = matches[0]?.loaderData as Partial<SeoConfiguration> | undefined;
  return {
    origin: typeof data?.origin === "string" ? data.origin : null,
    indexable: data?.indexable === true,
    googleSiteVerification:
      typeof data?.googleSiteVerification === "string" ? data.googleSiteVerification : null,
    ...(typeof data?.hasLocations === "boolean" ? { hasLocations: data.hasLocations } : {}),
  };
}

/** JSON data scripts must not be able to close their HTML script element. */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("JSON-LD must contain serializable data.");
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function createPublicPageHead(path: string, configuration: SeoConfiguration) {
  // Category filters and tracking parameters describe the same public page.
  const pathname =
    path.startsWith("/") && !path.startsWith("//")
      ? path.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/"
      : null;
  const page = PUBLIC_SEO_PAGES.find((entry) => entry.path === pathname);
  const meta: MetaHTMLAttributes<HTMLMetaElement>[] = [{ name: "robots", content: NOINDEX }];
  const links: { rel: string; href: string }[] = [];
  const scripts: { type: string; children: string }[] = [];
  if (!page) return { meta, links, scripts };

  const description =
    configuration.hasLocations === false
      ? page.description.replace(/pickup or delivery/g, "delivery")
      : page.description;

  meta.push(
    { title: page.title },
    { name: "description", content: description },
    { property: "og:title", content: page.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:title", content: page.title },
    { name: "twitter:description", content: description },
    { name: "twitter:card", content: configuration.origin ? "summary_large_image" : "summary" },
  );
  if (!configuration.origin) return { meta, links, scripts };

  const canonical = new URL(page.path, configuration.origin).href;
  const image = new URL(shareImage, configuration.origin).href;
  links.push({ rel: "canonical", href: canonical });
  meta[0] = {
    name: "robots",
    content: configuration.indexable ? INDEXABLE : NOINDEX,
  };
  meta.push(
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1920" },
    { property: "og:image:height", content: "1088" },
    { property: "og:image:alt", content: "A Grill & Swill feast with burgers, pizza and sides" },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: "A Grill & Swill feast with burgers, pizza and sides" },
  );

  const home = new URL("/", configuration.origin).href;
  const organizationId = `${home}#organization`;
  const websiteId = `${home}#website`;
  if (page.path === "/") {
    scripts.push({
      type: "application/ld+json",
      children: serializeJsonLd({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": organizationId,
            name: "Grill & Swill",
            url: home,
          },
          {
            "@type": "WebSite",
            "@id": websiteId,
            name: "Grill & Swill",
            url: home,
            inLanguage: "en",
            publisher: { "@id": organizationId },
          },
        ],
      }),
    });
  } else {
    scripts.push({
      type: "application/ld+json",
      children: serializeJsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: home },
          { "@type": "ListItem", position: 2, name: page.label, item: canonical },
        ],
      }),
    });
  }
  return { meta, links, scripts };
}
