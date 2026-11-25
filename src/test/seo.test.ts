import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";

import {
  createPublicPageHead,
  PUBLIC_SEO_PAGES,
  seoFromMatches,
  serializeJsonLd,
  type SeoConfiguration,
} from "@/lib/seo";

const ORIGIN = "https://grill-swill.com";
const configuration: SeoConfiguration = {
  origin: ORIGIN,
  indexable: true,
  googleSiteVerification: null,
};

const robots = (head: ReturnType<typeof createPublicPageHead>) =>
  head.meta.find((entry) => "name" in entry && entry.name === "robots");

describe("Public page SEO and privacy", () => {
  it("uses direct root loader configuration in every public route head without duplicate metadata", async () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    for (const page of PUBLIC_SEO_PAGES) {
      // Match and inspect head callbacks; never execute catalog or database loaders.
      const matches = router.matchRoutes(page.path).map((match, index) => ({
        ...match,
        loaderData: index === 0 ? configuration : undefined,
      }));
      const leaf = matches.at(-1)!;
      const headFunction = router.routesById[leaf.routeId]!.options.head!;
      const head = await headFunction({ matches } as never);
      expect(head?.links).toContainEqual({
        rel: "canonical",
        href: new URL(page.path, ORIGIN).href,
      });
      expect(head?.meta).toContainEqual({ title: page.title });
      expect(head?.meta).toContainEqual({
        name: "robots",
        content: "index, follow, max-image-preview:large",
      });
      const metadataKeys = (head?.meta ?? []).flatMap((entry) => {
        if (!entry) return [];
        if ("name" in entry) return [`name:${entry.name}`];
        if ("property" in entry) return [`property:${entry.property}`];
        if ("title" in entry) return ["title"];
        return [];
      });
      expect(new Set(metadataKeys).size).toBe(metadataKeys.length);
      expect(head?.scripts).toHaveLength(1);
    }
  });

  it("limits the public registry to marketing pages with distinct titles/descriptions", () => {
    expect(PUBLIC_SEO_PAGES.map((page) => page.path)).toEqual([
      "/",
      "/menu",
      "/deals",
      "/catering",
      "/gallery",
      "/locations",
    ]);
    const titles = PUBLIC_SEO_PAGES.map((page) => {
      const head = createPublicPageHead(page.path, configuration);
      expect(head.meta).toContainEqual({ name: "description", content: page.description });
      expect(head.meta).toContainEqual({ property: "og:title", content: page.title });
      expect(robots(head)).toMatchObject({ content: "index, follow, max-image-preview:large" });
      return page.title;
    });
    expect(new Set(titles).size).toBe(PUBLIC_SEO_PAGES.length);
  });

  it.each([
    "/menu?cat=pizza&token=synthetic-private-value#details",
    "/menu/?utm_source=synthetic-tracking#details",
    "/menu#synthetic-fragment",
  ])("canonicalizes %s without exporting filters, tokens or fragments", (path) => {
    const head = createPublicPageHead(path, configuration);
    expect(head.links).toContainEqual({ rel: "canonical", href: `${ORIGIN}/menu` });
    expect(head.meta).toContainEqual({ property: "og:url", content: `${ORIGIN}/menu` });
    expect(JSON.stringify(head)).not.toMatch(
      /synthetic-private|synthetic-tracking|synthetic-fragment|cat=|utm_source=/,
    );
    expect(head.scripts).toHaveLength(1);
    const breadcrumb = JSON.parse(head.scripts[0]!.children);
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(breadcrumb.itemListElement.map((entry: { item: string }) => entry.item)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/menu`,
    ]);
  });

  it.each([
    "/checkout?token=synthetic-private-value",
    "/admin",
    "/kitchen",
    "/rewards",
    "/account/orders",
    "/orders/synthetic-order?token=synthetic-private-value",
    "/receipts/synthetic-order?token=synthetic-private-value",
    "/api/payments/verify?transaction_id=123",
    "/unknown-page",
    "https://grill-swill.com/menu",
    "//grill-swill.com/menu",
    "menu",
  ])("does not publish canonical URLs or schema for %s", (path) => {
    const head = createPublicPageHead(path, configuration);
    expect(robots(head)).toMatchObject({ content: "noindex, nofollow" });
    expect(head.links).toEqual([]);
    expect(head.scripts).toEqual([]);
    expect(JSON.stringify(head)).not.toContain("synthetic-private-value");
  });

  it("keeps unconfigured and preview pages out of search while preserving useful metadata", () => {
    const unconfigured = createPublicPageHead("/menu", {
      origin: null,
      indexable: false,
      googleSiteVerification: null,
    });
    expect(robots(unconfigured)).toMatchObject({ content: "noindex, nofollow" });
    expect(unconfigured.meta).toContainEqual({ title: PUBLIC_SEO_PAGES[1].title });
    expect(unconfigured.links).toEqual([]);
    expect(unconfigured.scripts).toEqual([]);

    const preview = createPublicPageHead("/menu", { ...configuration, indexable: false });
    expect(robots(preview)).toMatchObject({ content: "noindex, nofollow" });
    expect(preview.links).toContainEqual({ rel: "canonical", href: `${ORIGIN}/menu` });
  });

  it("emits factual homepage organization/website data rather than fabricated restaurant details", () => {
    const head = createPublicPageHead("/?token=synthetic-private-value", configuration);
    expect(head.scripts).toHaveLength(1);
    expect(head.scripts[0]!.type).toBe("application/ld+json");
    const data = JSON.parse(head.scripts[0]!.children);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
    for (const node of data["@graph"]) {
      expect(node.name).toBe("Grill & Swill");
      expect(node.url).toBe(`${ORIGIN}/`);
    }
    expect(data["@graph"][1].publisher["@id"]).toBe(data["@graph"][0]["@id"]);
    expect(JSON.stringify(data)).not.toMatch(
      /aggregateRating|reviewCount|streetAddress|telephone|Restaurant|synthetic-private-value/,
    );
  });
});

describe("SEO configuration serialization boundary", () => {
  it("emits one verification meta tag from the root loader's public token", async () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });
    const root = router.matchRoutes("/")[0]!;
    const head = await router.routesById[root.routeId]!.options.head!({
      loaderData: { ...configuration, googleSiteVerification: "synthetic-google-proof" },
    } as never);
    expect(
      head?.meta?.filter(
        (entry) => entry && "name" in entry && entry.name === "google-site-verification",
      ),
    ).toEqual([{ name: "google-site-verification", content: "synthetic-google-proof" }]);
  });

  it("takes the root loader configuration and omits unexpected sensitive properties", () => {
    const result = seoFromMatches([
      { loaderData: { ...configuration, MONGODB_URI: "synthetic-private-config", role: "admin" } },
      { loaderData: { origin: "https://other-grill-swill.com", indexable: false } },
    ]);
    expect(result).toEqual(configuration);
    expect(JSON.stringify(result)).not.toMatch(/synthetic-private-config|MONGODB_URI|admin/);
  });

  it("fails closed for missing/malformed root loader data instead of trusting a child route", () => {
    const fallback = { origin: null, indexable: false, googleSiteVerification: null };
    expect(seoFromMatches([])).toEqual(fallback);
    expect(seoFromMatches([{ loaderData: null }, { loaderData: configuration }])).toEqual(fallback);
    expect(
      seoFromMatches([
        { loaderData: { origin: 123, indexable: "true", googleSiteVerification: {} } },
      ]),
    ).toEqual(fallback);
  });
});

describe("JSON-LD HTML safety", () => {
  it("round-trips data while preventing script termination and HTML-special characters", () => {
    const value = {
      "@context": "https://schema.org",
      name: "</script><script>synthetic()</script>&\u2028\u2029",
    };
    const serialized = serializeJsonLd(value);
    expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(serialized)).toEqual(value);
  });

  it("rejects a value that cannot produce JSON data", () => {
    expect(() => serializeJsonLd(undefined)).toThrow(TypeError);
  });
});
