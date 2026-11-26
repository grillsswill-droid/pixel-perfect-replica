import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import {
  routeTree,
  type FileRoutesByFullPath,
  type FileRoutesByTo,
  type FileRoutesById,
} from "./routeTree.gen";
import { customerRoutes } from "./customer-routes";

// Extend the existing generated file routes through TanStack's public route API.
// Keep managed generated files untouched and attach the new routes only once.
type CustomerRoutesByPath = {
  "/faq": typeof customerRoutes.FaqRoute;
  "/support": typeof customerRoutes.SupportRoute;
  "/privacy": typeof customerRoutes.PrivacyRoute;
  "/terms": typeof customerRoutes.TermsRoute;
  "/refund-policy": typeof customerRoutes.RefundPolicyRoute;
  "/delivery-policy": typeof customerRoutes.DeliveryPolicyRoute;
  "/allergens": typeof customerRoutes.AllergensRoute;
  "/cookies": typeof customerRoutes.CookiesRoute;
  "/accessibility": typeof customerRoutes.AccessibilityRoute;
};
type AppRouteTypes = {
  fileRoutesByFullPath: FileRoutesByFullPath & CustomerRoutesByPath;
  fullPaths: keyof (FileRoutesByFullPath & CustomerRoutesByPath);
  fileRoutesByTo: FileRoutesByTo & CustomerRoutesByPath;
  to: keyof (FileRoutesByTo & CustomerRoutesByPath);
  fileRoutesById: FileRoutesById & CustomerRoutesByPath;
  id: keyof (FileRoutesById & CustomerRoutesByPath);
};
const customerPaths = new Set<string>(
  Object.values(customerRoutes).map((route) =>
    "path" in route.options ? (route.options.path ?? "") : "",
  ),
);
const existingChildren = Object.values(routeTree.children ?? {}).filter(
  (route) => !("path" in route.options && customerPaths.has(route.options.path ?? "")),
);
const appRouteTree = routeTree
  .addChildren([...existingChildren, ...Object.values(customerRoutes)])
  ._addFileTypes<AppRouteTypes>();

declare module "@tanstack/router-core" {
  interface SerializableExtensions {
    reactQueryState: DehydratedState;
  }
}

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree: appRouteTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
    dehydrate: () => ({
      reactQueryState: dehydrate(queryClient),
    }),
    hydrate: ({ reactQueryState }) => {
      hydrate(queryClient, reactQueryState);
    },
  });

  return router;
};
