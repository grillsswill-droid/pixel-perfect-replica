import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartDrawer } from "@/components/site/cart-drawer";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BrandLoading, SiteMotion } from "@/components/site/site-motion";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/hooks/use-cart";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-8xl font-black text-primary">404</p>
        <h1 className="mt-4 text-2xl font-black uppercase">This one fell off the grill</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="hero">
            <Link to="/menu">See the menu</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black uppercase">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. Try again, or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="hero"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Never add og:image or twitter:image here: every page without its own would inherit it.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Grill & Swill Fast Food" },
      { name: "description", content: "Smashed burgers, crispy chicken, wood-fired pizza and cold brew. Order delivery or pickup." },
      { name: "author", content: "Grill & Swill" },
      { name: "theme-color", content: "#B84414" },
      { property: "og:site_name", content: "Grill & Swill" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Figtree:wght@400..800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  pendingComponent: BrandLoading,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <SiteMotion />
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              <Outlet />
            </main>
            <SiteFooter />
          </div>
          <CartDrawer />
          <Toaster position="top-center" richColors closeButton />
        </CartProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
