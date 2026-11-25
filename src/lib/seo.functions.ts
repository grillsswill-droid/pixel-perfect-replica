import { createServerFn } from "@tanstack/react-start";

/** Only public SEO settings cross the server/browser boundary. */
export const getSeoConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { getSeoConfigurationForRequest } = await import("./seo.server");
  return getSeoConfigurationForRequest(getRequest());
});
