import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleSeoRoute } from "./lib/seo-routes.server";
import { applySeoResponseHeaders } from "./lib/seo.server";
import { handleSupportRequest } from "./lib/support.server";
import { loadLocalServerEnvironment } from "./lib/server-environment.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      loadLocalServerEnvironment();
      const seoResponse = handleSeoRoute(request);
      if (seoResponse) return seoResponse;
      if (new URL(request.url).pathname === "/api/support")
        return await handleSupportRequest(request);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySeoResponseHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      if (new URL(request.url).pathname === "/api/support") {
        console.warn("Support request unavailable.", { code: "support_handler_failed" });
        void request.body?.cancel().catch(() => undefined);
        return Response.json(
          { ok: false, error: "We couldn't save your message. Please try again." },
          {
            status: 503,
            headers: {
              "cache-control": "no-store",
              "x-robots-tag": "noindex, nofollow",
              "retry-after": "60",
            },
          },
        );
      }
      console.error(error);
      return applySeoResponseHeaders(
        request,
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
