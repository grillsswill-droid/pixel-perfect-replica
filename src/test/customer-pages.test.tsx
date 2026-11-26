import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-storefront-locations", () => ({
  useStorefrontLocations: () => ({ hasLocations: true }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

import { BrowserControls, ExternalMap } from "@/components/customer/browser-controls";
import { FaqPage } from "@/components/customer/faq-page";
import {
  AccessibilityPage,
  AllergensPage,
  CookiesPage,
  DeliveryPolicyPage,
  PrivacyPage,
  RefundPolicyPage,
  TermsPage,
} from "@/components/customer/policy-pages";
import { CustomerSiteProvider } from "@/hooks/use-customer-site";
import {
  clearCustomerBrowserData,
  CUSTOMER_LOCAL_STORAGE_KEYS,
  CUSTOMER_SESSION_STORAGE_KEYS,
  MAP_PREFERENCE_KEY,
} from "@/lib/browser-privacy";
import { FAQ_GROUPS, PUBLIC_POLICY_PAGES, type CustomerPolicyPage } from "@/lib/customer-content";
import { CUSTOMER_POLICY_LINKS, DEFAULT_CUSTOMER_CONFIGURATION } from "@/lib/customer-site";

const components: Record<string, ComponentType> = {
  privacy: PrivacyPage,
  terms: TermsPage,
  "refund-policy": RefundPolicyPage,
  "delivery-policy": DeliveryPolicyPage,
  allergens: AllergensPage,
  cookies: CookiesPage,
  accessibility: AccessibilityPage,
};
const publicConfiguration = {
  ...DEFAULT_CUSTOMER_CONFIGURATION,
  supportEmail: "support@example.invalid",
};

beforeEach(() => {
  // Node 26's optional global storage must not shadow jsdom's real browser storage.
  const domWindow = (globalThis as typeof globalThis & { jsdom: { window: Window } }).jsdom.window;
  vi.stubGlobal("localStorage", domWindow.localStorage);
  vi.stubGlobal("sessionStorage", domWindow.sessionStorage);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function show(Component: ComponentType) {
  return render(
    <CustomerSiteProvider configuration={publicConfiguration}>
      <Component />
    </CustomerSiteProvider>,
  );
}

describe("Customer policy navigation and factual rendering", () => {
  it.each(PUBLIC_POLICY_PAGES as readonly CustomerPolicyPage[])(
    "renders $slug sections with real anchors and a direct support route",
    (policy) => {
      const Component = components[policy.slug]!;
      const { container } = show(Component);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(policy.title);
      const sectionLinks = container.querySelectorAll(
        'nav[aria-label="On this page"] a[href^="#policy-section-"]',
      );
      expect(sectionLinks).toHaveLength(policy.sections.length);
      for (const link of sectionLinks) {
        const target = container.querySelector(link.getAttribute("href")!);
        expect(target).not.toBeNull();
        expect(target?.querySelector("h2")).toHaveTextContent(link.textContent!);
      }
      for (const link of screen.getAllByRole("link", { name: "Contact support" })) {
        expect(link).toHaveAttribute("href", "/support");
      }
      const otherPolicies = container.querySelectorAll('nav[aria-label="Other policies"] a');
      expect([...otherPolicies].map((link) => link.getAttribute("href"))).toEqual(
        CUSTOMER_POLICY_LINKS.filter((link) => link.path !== `/${policy.slug}`).map(
          (link) => link.path,
        ),
      );
      expect(container).not.toHaveTextContent("Business jurisdiction:");
    },
  );

  it("explains refund review without displaying an automatic-refund action", () => {
    const { container } = show(RefundPolicyPage);
    expect(container).toHaveTextContent("does not run an automatic payment-refund workflow");
    expect(container).toHaveTextContent("original payment method");
    expect(
      screen.queryByRole("button", { name: /issue refund|refund now/i }),
    ).not.toBeInTheDocument();
  });
});

describe("FAQ search and recovery", () => {
  it("renders every provided answer and preserves a useful no-results recovery path", () => {
    const { container } = show(FaqPage);
    const count = FAQ_GROUPS.reduce((total, group) => total + group.items.length, 0);
    expect(container.querySelectorAll("summary")).toHaveLength(count);
    expect(screen.getByRole("status")).toHaveTextContent(`${count} answers`);
    fireEvent.change(screen.getByLabelText("Search the FAQs"), {
      target: { value: "no-such-synthetic-answer" },
    });
    expect(container.querySelectorAll("summary")).toHaveLength(0);
    expect(screen.getByText(/No answers match/)).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Contact support" })) {
      expect(link).toHaveAttribute("href", "/support");
    }
    fireEvent.click(screen.getByRole("button", { name: "Clear FAQ search" }));
    expect(container.querySelectorAll("summary")).toHaveLength(count);
  });

  it("finds a payment problem by its answer text without requiring an exact question", () => {
    const { container } = show(FaqPage);
    fireEvent.change(screen.getByLabelText("Search the FAQs"), {
      target: { value: "bank authorisation" },
    });
    expect(container.querySelectorAll("summary")).toHaveLength(1);
    expect(container.querySelector("summary")).toHaveTextContent("I was charged");
    expect(screen.getByRole("status")).toHaveTextContent("1 answer found");
  });
});

describe("Browser privacy choices", () => {
  it("clears only customer keys while preserving unrelated application data", () => {
    for (const key of CUSTOMER_LOCAL_STORAGE_KEYS)
      localStorage.setItem(key, "synthetic-customer-data");
    for (const key of CUSTOMER_SESSION_STORAGE_KEYS)
      sessionStorage.setItem(key, "synthetic-checkout-data");
    localStorage.setItem("unrelated-application-preference", "preserve-local");
    sessionStorage.setItem("unrelated-application-session", "preserve-session");
    clearCustomerBrowserData(localStorage, sessionStorage);
    for (const key of CUSTOMER_LOCAL_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull();
    for (const key of CUSTOMER_SESSION_STORAGE_KEYS) expect(sessionStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem("unrelated-application-preference")).toBe("preserve-local");
    expect(sessionStorage.getItem("unrelated-application-session")).toBe("preserve-session");
  });

  it("does not embed an external map until the customer chooses to load it", () => {
    const src = "https://www.openstreetmap.org/export/embed.html?marker=0,0";
    const { container } = render(<ExternalMap src={src} title="Synthetic store map" />);
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load map" }));
    expect(container.querySelector("iframe")).toHaveAttribute("title", "Synthetic store map");
    expect(container.querySelector("iframe")).toHaveAttribute("src", src);
    expect(localStorage.getItem(MAP_PREFERENCE_KEY)).toBe("allowed");
  });

  it("requires confirmation before clearing and retains data when the customer cancels", () => {
    localStorage.setItem("grill-swill-guest-id", "synthetic-retained-identity");
    render(<BrowserControls />);
    fireEvent.click(screen.getByRole("button", { name: "Clear my browser data" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Server records remain");
    expect(localStorage.getItem("grill-swill-guest-id")).toBe("synthetic-retained-identity");
    fireEvent.click(screen.getByRole("button", { name: "Keep my data" }));
    expect(localStorage.getItem("grill-swill-guest-id")).toBe("synthetic-retained-identity");
  });

  it("records explicit map preferences and announces their effect", () => {
    render(<BrowserControls />);
    const toggle = screen.getByLabelText("Allow embedded OpenStreetMap maps");
    fireEvent.click(toggle);
    expect(localStorage.getItem(MAP_PREFERENCE_KEY)).toBe("allowed");
    expect(screen.getByRole("status")).toHaveTextContent("can load when you visit Locations");
    fireEvent.click(toggle);
    expect(localStorage.getItem(MAP_PREFERENCE_KEY)).toBe("blocked");
    expect(screen.getByRole("status")).toHaveTextContent("wait until you choose");
  });
});
