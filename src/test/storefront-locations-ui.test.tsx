import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    activeProps: _activeProps,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    to: string;
    children?: ReactNode | ((state: { isActive: boolean }) => ReactNode);
    activeProps?: unknown;
  }) => (
    <a href={to} {...props}>
      {typeof children === "function" ? children({ isActive: false }) : children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/" } }),
  useNavigate: () => vi.fn(),
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useSearch: () => ({}),
  }),
}));
vi.mock("@/lib/admin.functions", () => ({
  getCheckoutConfiguration: async () => ({ tickerMessages: [] }),
}));
vi.mock("@/lib/cart.functions", () => ({
  getCart: async () => null,
  saveCart: async () => ({ ok: true }),
}));
vi.mock("@/hooks/use-guest", () => ({ useGuestId: () => "00000000-0000-4000-8000-000000000001" }));
vi.mock("@/lib/order-queries", () => ({
  guestRewardsQuery: () =>
    queryOptions({ queryKey: ["guest-rewards"], queryFn: async () => ({ points: 0 }) }),
}));

import { CartDrawer } from "@/components/site/cart-drawer";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { FaqPage } from "@/components/customer/faq-page";
import {
  CookiesPage,
  DeliveryPolicyPage,
  PrivacyPage,
  TermsPage,
} from "@/components/customer/policy-pages";
import { CartProvider, useCart } from "@/hooks/use-cart";
import type { CartLine, Store } from "@/lib/menu-types";
import { Route as checkoutRoute } from "@/routes/checkout";

const CheckoutPage = checkoutRoute.options.component as ComponentType;
const store: Store = {
  id: "00000000-0000-4000-8000-000000000012",
  name: "Configured grill",
  address: "123 Test Street",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "5125550100",
  lat: 0,
  lng: 0,
  hours: "Daily 10am–8pm",
  features: [],
};
const line: CartLine = {
  key: "test-burger",
  itemId: "00000000-0000-4000-8000-000000000002",
  slug: "test-burger",
  category: "burgers",
  name: "Test burger",
  imageKey: "burger",
  quantity: 1,
  selections: {},
  removed: [],
  note: "",
  unitPriceCents: 1000,
  summary: [],
};
let client: QueryClient;

beforeEach(() => {
  const domWindow = (globalThis as typeof globalThis & { jsdom: { window: Window } }).jsdom.window;
  vi.stubGlobal("localStorage", domWindow.localStorage);
  vi.stubGlobal("sessionStorage", domWindow.sessionStorage);
  window.localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["stores"], []);
});
afterEach(() => {
  cleanup();
  client.clear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function CartProbe() {
  const cart = useCart();
  return (
    <>
      <output data-testid="cart-state">
        {cart.fulfillment}|{cart.storeId ?? "none"}
      </output>
      <button type="button" onClick={() => cart.setOpen(true)}>
        Open test bag
      </button>
    </>
  );
}
function show(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>
      <CartProvider>{children}</CartProvider>
    </QueryClientProvider>,
  );
}

describe("Location availability across the storefront", () => {
  it("omits desktop, mobile and footer links and pickup when no location exists", () => {
    const { container } = show(
      <>
        <SiteHeader />
        <SiteFooter />
        <CartProbe />
        <CartDrawer />
      </>,
    );
    expect(container.querySelectorAll('a[href="/locations"]')).toHaveLength(0);
    expect(container).not.toHaveTextContent(/pickup|nearest grill|hours vary by location/i);
    fireEvent.click(screen.getByRole("button", { name: "Open test bag" }));
    expect(screen.queryByRole("radio", { name: "pickup" })).not.toBeInTheDocument();
  });

  it("shows locations and pickup when a location is added, and hides them when the last is removed", async () => {
    const { container } = show(
      <>
        <SiteHeader />
        <SiteFooter />
        <CartProbe />
        <CartDrawer />
      </>,
    );
    await act(async () => { client.setQueryData(["stores"], [store]); });
    await waitFor(() => {
      expect(container.querySelector('nav[aria-label="Main"] a[href="/locations"]')).not.toBeNull();
      expect(container.querySelector('nav[aria-label="Mobile navigation"] a[href="/locations"]')).not.toBeNull();
      expect(screen.getByRole("link", { name: "Find a grill" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open test bag" }));
    fireEvent.click(screen.getByRole("radio", { name: "pickup" }));
    expect(screen.getByTestId("cart-state")).toHaveTextContent(`pickup|${store.id}`);
    await act(async () => { client.setQueryData(["stores"], []); });
    await waitFor(() => {
      expect(container.querySelectorAll('a[href="/locations"]')).toHaveLength(0);
      expect(screen.queryByRole("radio", { name: "pickup" })).not.toBeInTheDocument();
      expect(screen.getByTestId("cart-state")).toHaveTextContent("delivery|none");
    });
  });

  it("clears saved pickup selections and permits delivery checkout without a store", async () => {
    window.localStorage.setItem(
      "grill-swill-cart-v1",
      JSON.stringify({ lines: [line], fulfillment: "pickup", storeId: store.id }),
    );
    const { container } = show(
      <>
        <CartProbe />
        <CheckoutPage />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("cart-state")).toHaveTextContent("delivery|none"),
    );
    expect(container).not.toHaveTextContent(/pickup|pick up at|delivering from|configured grill/i);
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await screen.findByRole("heading", { name: "Where should we bring it?" });
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("grill-swill-cart-v1")!)).toMatchObject({
        fulfillment: "delivery",
        storeId: null,
      }),
    );
  });

  it.each([FaqPage, PrivacyPage, TermsPage, DeliveryPolicyPage, CookiesPage])(
    "removes location, map and pickup prompts from customer help with no configured stores (%#)",
    (Page) => {
      const { container } = show(<Page />);
      expect(container).not.toHaveTextContent(
        /pickup|pick up|selected store|chosen store|store choice|locations page|OpenStreetMap/i,
      );
    },
  );
});
