import { PUBLIC_SEO_PAGES } from "./seo";
import { getSeoConfigurationForRequest } from "./seo.server";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** Serve discovery documents before SSR; they need neither a database nor a session. */
export function handleSeoRoute(request: Request): Response | null {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/robots.txt" && pathname !== "/sitemap.xml") return null;

  const headOnly = request.method === "HEAD";
  if (request.method !== "GET" && !headOnly) {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const configuration = getSeoConfigurationForRequest(request);
  const headers = {
    "Cache-Control": configuration.indexable ? "public, max-age=300, s-maxage=300" : "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };

  if (pathname === "/robots.txt") {
    // Crawlers need access to read page noindex directives; authentication controls access.
    const body = configuration.indexable
      ? `User-agent: *\nAllow: /\n\nSitemap: ${configuration.origin}/sitemap.xml\n`
      : "User-agent: *\nAllow: /\n";
    return new Response(headOnly ? null : body, {
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!configuration.indexable || !configuration.origin) {
    return new Response(headOnly ? null : "Sitemap is unavailable for this deployment.", {
      status: 404,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const entries = PUBLIC_SEO_PAGES.map(
    (page) =>
      `  <url><loc>${escapeXml(new URL(page.path, configuration.origin!).href)}</loc></url>`,
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  return new Response(headOnly ? null : body, {
    headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" },
  });
}
