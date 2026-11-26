import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { Route as rootRoute } from "./routes/__root";
import { createPublicPageHead, seoFromMatches } from "./lib/seo";

const head =
  (path: string) =>
  ({ matches }: { matches: { loaderData?: unknown }[] }) =>
    createPublicPageHead(path, seoFromMatches(matches));

const faq = createRoute({
  getParentRoute: () => rootRoute,
  path: "faq",
  head: head("/faq"),
  component: lazyRouteComponent(() => import("./components/customer/faq-page"), "FaqPage"),
});
const support = createRoute({
  getParentRoute: () => rootRoute,
  path: "support",
  head: head("/support"),
  component: lazyRouteComponent(() => import("./components/customer/support-page"), "SupportPage"),
});
const privacy = createRoute({
  getParentRoute: () => rootRoute,
  path: "privacy",
  head: head("/privacy"),
  component: lazyRouteComponent(() => import("./components/customer/policy-pages"), "PrivacyPage"),
});
const terms = createRoute({
  getParentRoute: () => rootRoute,
  path: "terms",
  head: head("/terms"),
  component: lazyRouteComponent(() => import("./components/customer/policy-pages"), "TermsPage"),
});
const refunds = createRoute({
  getParentRoute: () => rootRoute,
  path: "refund-policy",
  head: head("/refund-policy"),
  component: lazyRouteComponent(
    () => import("./components/customer/policy-pages"),
    "RefundPolicyPage",
  ),
});
const delivery = createRoute({
  getParentRoute: () => rootRoute,
  path: "delivery-policy",
  head: head("/delivery-policy"),
  component: lazyRouteComponent(
    () => import("./components/customer/policy-pages"),
    "DeliveryPolicyPage",
  ),
});
const allergens = createRoute({
  getParentRoute: () => rootRoute,
  path: "allergens",
  head: head("/allergens"),
  component: lazyRouteComponent(
    () => import("./components/customer/policy-pages"),
    "AllergensPage",
  ),
});
const cookies = createRoute({
  getParentRoute: () => rootRoute,
  path: "cookies",
  head: head("/cookies"),
  component: lazyRouteComponent(() => import("./components/customer/policy-pages"), "CookiesPage"),
});
const accessibility = createRoute({
  getParentRoute: () => rootRoute,
  path: "accessibility",
  head: head("/accessibility"),
  component: lazyRouteComponent(
    () => import("./components/customer/policy-pages"),
    "AccessibilityPage",
  ),
});

export const customerRoutes = {
  FaqRoute: faq,
  SupportRoute: support,
  PrivacyRoute: privacy,
  TermsRoute: terms,
  RefundPolicyRoute: refunds,
  DeliveryPolicyRoute: delivery,
  AllergensRoute: allergens,
  CookiesRoute: cookies,
  AccessibilityRoute: accessibility,
} as const;
