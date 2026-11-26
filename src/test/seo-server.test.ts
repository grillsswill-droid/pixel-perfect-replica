import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  database: vi.fn(() => {
    throw new Error("SEO discovery must not access the database");
  }),
  frameworkFetch: vi.fn(),
}));

vi.mock("@/lib/mongodb.server", () => ({ getMongoDatabase: mocks.database }));
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: mocks.frameworkFetch },
}));

import {
  applySeoResponseHeaders,
  getSeoConfigurationForRequest,
  parsePublicSiteOrigin,
} from "@/lib/seo.server";
import { handleSeoRoute } from "@/lib/seo-routes.server";
import { PUBLIC_SEO_PAGES } from "@/lib/seo";
import server from "../server";

// Synthetic deployment configuration. Tests never contact this host or a provider.
const ORIGIN = "https://grill-swill.com";
const request = (path: string, method = "GET", origin = ORIGIN) =>
  new Request(`${origin}${path}`, { method });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PUBLIC_SITE_URL", ORIGIN);
  vi.stubEnv("SEO_INDEXING_ENABLED", "");
  vi.stubEnv("GOOGLE_SITE_VERIFICATION", "");
  mocks.database.mockClear();
  mocks.frameworkFetch.mockReset();
  mocks.frameworkFetch.mockImplementation(
    async () => new Response("Synthetic page", { headers: { "content-type": "text/html" } }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Deployment indexing authority", () => {
  it("normalizes an explicitly configured HTTPS origin and indexes only that origin", () => {
    expect(parsePublicSiteOrigin("  https://GRILL-SWILL.com:443/  ")).toBe(ORIGIN);
    expect(getSeoConfigurationForRequest(request("/menu?cat=pizza#details"))).toEqual({
      origin: ORIGIN,
      indexable: true,
      googleSiteVerification: null,
    });
    const mismatched = new Request("https://preview-grill-swill.com/menu", {
      headers: { host: "grill-swill.com", "x-forwarded-host": "grill-swill.com" },
    });
    expect(getSeoConfigurationForRequest(mismatched).indexable).toBe(false);
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "",
    "http://grill-swill.com",
    "https://user:password@grill-swill.com",
    "https://grill-swill.com:8443",
    "https://grill-swill.com/menu",
    "https://grill-swill.com/?token=synthetic-private-value",
    "https://grill-swill.com/#tracking",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://preview.example",
    "https://preview.invalid",
    "https://service.internal",
  ])("does not trust unsafe or non-public configured origins: %s", (value) => {
    expect(parsePublicSiteOrigin(value)).toBeNull();
  });

  it.each([
    ["NODE_ENV", "development"],
    ["VERCEL_ENV", "preview"],
    ["VERCEL_ENV", "development"],
    ["SEO_INDEXING_ENABLED", "false"],
    ["SEO_INDEXING_ENABLED", "not-a-boolean"],
    ["PUBLIC_SITE_URL", ""],
  ])("fails closed when %s is %s", (name, value) => {
    vi.stubEnv(name, value);
    expect(getSeoConfigurationForRequest(request("/")).indexable).toBe(false);
    const robots = handleSeoRoute(request("/robots.txt"))!;
    expect(robots.headers.get("cache-control")).toBe("no-store");
    const sitemap = handleSeoRoute(request("/sitemap.xml"))!;
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("accepts a public verification token without accepting pasted HTML", () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "synthetic-google-proof_123-ABC");
    expect(getSeoConfigurationForRequest(request("/")).googleSiteVerification).toBe(
      "synthetic-google-proof_123-ABC",
    );
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", '<meta name="google-site-verification">');
    expect(getSeoConfigurationForRequest(request("/")).googleSiteVerification).toBeNull();
  });
});

describe("Robots and sitemap HTTP discovery", () => {
  it("advertises the canonical sitemap without database or SSR access", async () => {
    const response = await server.fetch(
      request("/robots.txt?token=synthetic-private-value"),
      {},
      {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("Allow: /");
    expect(text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(text).not.toContain("token=");
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.frameworkFetch).not.toHaveBeenCalled();
  });

  it("publishes registered public canonical URLs without personal data in valid sitemap XML", async () => {
    const response = await server.fetch(
      request("/sitemap.xml?token=synthetic-private-value"),
      {},
      {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const text = await response.text();
    const document = new DOMParser().parseFromString(text, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    const locations = [...document.querySelectorAll("loc")].map((node) => node.textContent);
    expect(locations).toEqual(
      PUBLIC_SEO_PAGES.filter((page) => page.path !== "/locations").map(
        (page) => new URL(page.path, ORIGIN).href,
      ),
    );
    expect(locations).toEqual(
      expect.arrayContaining([`${ORIGIN}/faq`, `${ORIGIN}/support`, `${ORIGIN}/privacy`]),
    );
    expect(text).not.toMatch(
      /token=|guestId|checkout|receipts|orders|account|admin|kitchen|rewards|\/locations/,
    );
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.frameworkFetch).not.toHaveBeenCalled();
  });

  it.each(["/robots.txt", "/sitemap.xml"])(
    "serves HEAD %s with GET metadata and no body",
    async (path) => {
      const get = handleSeoRoute(request(path))!;
      const head = await server.fetch(request(path, "HEAD"), {}, {});
      expect(head.status).toBe(get.status);
      expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
      expect(head.headers.get("cache-control")).toBe(get.headers.get("cache-control"));
      expect(await head.text()).toBe("");
      expect(mocks.database).not.toHaveBeenCalled();
      expect(mocks.frameworkFetch).not.toHaveBeenCalled();
    },
  );

  it.each(["/robots.txt", "/sitemap.xml"])(
    "rejects unsupported POST %s before SSR",
    async (path) => {
      const response = await server.fetch(request(path, "POST"), {}, {});
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.database).not.toHaveBeenCalled();
      expect(mocks.frameworkFetch).not.toHaveBeenCalled();
    },
  );

  it("allows preview crawlers to see noindex while excluding the production sitemap", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const robots = await server.fetch(request("/robots.txt"), {}, {});
    const text = await robots.text();
    expect(text).toContain("Allow: /");
    expect(text).not.toContain("Disallow: /");
    expect(text).not.toContain("Sitemap:");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const sitemap = await server.fetch(request("/sitemap.xml"), {}, {});
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers.get("cache-control")).toBe("no-store");
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.frameworkFetch).not.toHaveBeenCalled();
  });
});

describe("Indexing response boundaries", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "keeps canonical production public media with %s discoverable",
    async (contentType) => {
      // Exercise header policy only; upload validation belongs to the media route.
      const bytes = new Uint8Array([1, 2, 3]);
      mocks.frameworkFetch.mockResolvedValueOnce(
        new Response(bytes, {
          headers: {
            "content-type": contentType,
            "x-content-type-options": "nosniff",
            "cache-control": "public, max-age=31536000, immutable",
          },
        }),
      );
      const response = await server.fetch(request("/api/media/aaaaaaaaaaaaaaaaaaaaaaaa"), {}, {});
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toBeNull();
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(mocks.database).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "application/json", 200],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "text/html", 200],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "image/svg+xml", 200],
    ["/api/media/not-a-valid-id", "image/png", 200],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa/", "image/png", 200],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "image/png", 404],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "image/png", 500],
    ["/api/media/aaaaaaaaaaaaaaaaaaaaaaaa", "image/png", 206],
    ["/api/payments/verify", "image/png", 200],
    ["/admin", "image/png", 200],
  ] as const)(
    "keeps %s with %s and status %s outside the public-image exception",
    async (path, contentType, status) => {
      mocks.frameworkFetch.mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status,
          headers: { "content-type": contentType },
        }),
      );
      const response = await server.fetch(request(path), {}, {});
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(mocks.database).not.toHaveBeenCalled();
    },
  );

  it("keeps preview and noncanonical images non-indexable", async () => {
    const image = () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      });
    const path = "/api/media/aaaaaaaaaaaaaaaaaaaaaaaa";
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.frameworkFetch.mockResolvedValueOnce(image());
    expect((await server.fetch(request(path), {}, {})).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow",
    );
    vi.stubEnv("VERCEL_ENV", "production");
    mocks.frameworkFetch.mockResolvedValueOnce(image());
    expect(
      (
        await server.fetch(request(path, "GET", "https://preview-grill-swill.com"), {}, {})
      ).headers.get("x-robots-tag"),
    ).toBe("noindex, nofollow");
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    "/checkout",
    "/admin",
    "/kitchen",
    "/rewards",
    "/account/orders",
    "/orders/synthetic-id?token=synthetic-private-value",
    "/receipts/synthetic-id?token=synthetic-private-value",
    "/api/payments/verify?transaction_id=123",
    "/api/media/aaaaaaaaaaaaaaaaaaaaaaaa",
    "/_serverFn/synthetic-build-id",
    "/unknown-page",
  ])("marks %s as non-indexable through the server wrapper", async (path) => {
    const response = await server.fetch(request(path), {}, {});
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("preserves a successful canonical public page while marking errors and preview pages", () => {
    const success = new Response("Synthetic public page", { status: 200 });
    expect(applySeoResponseHeaders(request("/menu?cat=pizza"), success)).toBe(success);
    const missing = applySeoResponseHeaders(
      request("/menu"),
      new Response("Missing", { status: 404 }),
    );
    expect(missing.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(
      applySeoResponseHeaders(request("/menu"), new Response("Synthetic preview")).headers.get(
        "x-robots-tag",
      ),
    ).toBe("noindex, nofollow");
  });

  it("adds indexing policy without buffering the stream or changing cookies/status", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Synthetic streamed page"));
        controller.close();
      },
    });
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", "synthetic-staff=placeholder; HttpOnly; Secure");
    headers.append("set-cookie", "synthetic-admin=placeholder; HttpOnly; Secure");
    const original = new Response(stream, {
      status: 202,
      statusText: "Accepted",
      headers,
    });
    const response = applySeoResponseHeaders(request("/admin"), original);
    expect(original.bodyUsed).toBe(false);
    expect(response.body).toBe(stream);
    expect(response.status).toBe(202);
    expect(response.statusText).toBe("Accepted");
    expect(response.headers.getSetCookie()).toEqual(original.headers.getSetCookie());
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Synthetic streamed page");
  });

  it("marks catastrophic server failures as non-indexable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.frameworkFetch.mockRejectedValueOnce(new Error("Synthetic server failure"));
    const response = await server.fetch(request("/menu"), {}, {});
    expect(response.status).toBe(500);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.text()).not.toContain("Synthetic server failure");
  });
});
