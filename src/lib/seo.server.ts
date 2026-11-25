import { PUBLIC_SEO_PAGES, type SeoConfiguration } from "./seo";

const NON_PUBLIC_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".test",
  ".example",
  ".invalid",
  ".onion",
];

/** A canonical origin comes from deployment configuration, never request headers. */
export function parsePublicSiteOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    const hostname = url.hostname;
    const labels = hostname.split(".");
    if (
      hostname.length > 253 ||
      labels.length < 2 ||
      !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      !/[a-z]/i.test(labels[labels.length - 1] ?? "") ||
      NON_PUBLIC_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function deploymentAllowsIndexing(): boolean {
  if (process.env["NODE_ENV"] !== "production") return false;
  const vercelEnvironment = process.env["VERCEL_ENV"]?.trim().toLowerCase();
  if (vercelEnvironment && vercelEnvironment !== "production") return false;
  const indexingSetting = process.env["SEO_INDEXING_ENABLED"]?.trim().toLowerCase();
  return !indexingSetting || indexingSetting === "true";
}

function googleSiteVerification(): string | null {
  const token = process.env["GOOGLE_SITE_VERIFICATION"]?.trim();
  return token && /^[A-Za-z0-9_-]{1,256}$/.test(token) ? token : null;
}

export function getSeoConfigurationForRequest(request: Request): SeoConfiguration {
  const origin = parsePublicSiteOrigin(process.env["PUBLIC_SITE_URL"]);
  return {
    origin,
    indexable: Boolean(
      origin && deploymentAllowsIndexing() && new URL(request.url).origin === origin,
    ),
    googleSiteVerification: googleSiteVerification(),
  };
}

export function isPublicSeoPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_SEO_PAGES.some((page) => page.path === path);
}

function isPublicMediaResponse(pathname: string, response: Response): boolean {
  if (response.status !== 200 || !/^\/api\/media\/[a-f0-9]{24}$/i.test(pathname)) return false;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return (
    contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp"
  );
}

/** Preserve streamed bodies and response metadata while applying indexing directives. */
export function applySeoResponseHeaders(request: Request, response: Response): Response {
  const configuration = getSeoConfigurationForRequest(request);
  const pathname = new URL(request.url).pathname;
  if (
    configuration.indexable &&
    ((isPublicSeoPath(pathname) && response.status < 400) ||
      isPublicMediaResponse(pathname, response))
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
