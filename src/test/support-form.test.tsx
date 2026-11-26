import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  supportEmail: "support@example.invalid",
  inboxEnabled: true,
  emailDeliveryEnabled: false,
  businessName: "Grill & Swill",
  operatingRegions: "Worldwide",
  legalBusinessName: null,
  businessAddress: null,
  jurisdiction: null,
  supportHours: null,
}));
vi.mock("@/hooks/use-customer-site", () => ({ useCustomerSite: () => configuration }));
vi.mock("@/hooks/use-storefront-locations", () => ({
  useStorefrontLocations: () => ({ hasLocations: true }),
}));
vi.mock("@tanstack/react-router", () => ({
  // Navigation is covered separately; this suite exercises the actual form component.
  Link: ({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

import { SupportPage } from "@/components/customer/support-page";

let fetchMock: ReturnType<typeof vi.fn>;
const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

beforeEach(() => {
  configuration.inboxEnabled = true;
  let sequence = 0;
  vi.stubGlobal("crypto", { randomUUID: () => id(++sequence) });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    return Response.json(
      { ok: true, reference: `GS-${body.requestId.toUpperCase()}` },
      { status: 202 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Synthetic Customer" } });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "synthetic@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "A synthetic support question" },
  });
  fireEvent.change(screen.getByLabelText("Your message"), {
    target: { value: "Please review this harmless synthetic support question." },
  });
}

describe("Support form feedback and accessibility", () => {
  it("labels each control and connects message guidance to the textarea", () => {
    render(<SupportPage />);
    for (const name of [
      "Your name",
      "Email address",
      "What can we help with?",
      "Order or payment reference (optional)",
      "Subject",
      "Your message",
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Your message")).toHaveAccessibleDescription(/4,000 characters/);
    expect(screen.getByRole("link", { name: "privacy notice" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("announces validation errors, focuses the summary, and links to invalid controls", async () => {
    render(<SupportPage />);
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(summary).toHaveFocus());
    const name = screen.getByLabelText("Your name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "support-name-error");
    const nameLink = summary.querySelector<HTMLAnchorElement>('a[href="#support-name"]')!;
    expect(nameLink).not.toBeNull();
    fireEvent.click(nameLink);
    expect(name).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a received reference only after the server acknowledgement and disables pending controls", async () => {
    let complete: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
    );
    render(<SupportPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sending your request/ })).toBeDisabled();
    expect(screen.getByLabelText("Your name")).toBeDisabled();
    complete(Response.json({ ok: true, reference: `GS-${id(1).toUpperCase()}` }, { status: 202 }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Your message has been received");
    expect(status).toHaveTextContent(`GS-${id(1).toUpperCase()}`);
    expect(status).toHaveTextContent("not a refund approval or delivery promise");
    expect(status).not.toHaveTextContent(/email has been sent|refund has been issued/i);
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("retains entered details on failure and reuses the same request ID when retrying", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false }, { status: 503 }));
    render(<SupportPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your details are still here");
    expect(screen.getByLabelText("Your message")).toHaveValue(
      "Please review this harmless synthetic support question.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    await screen.findByRole("status");
    const identifiers = fetchMock.mock.calls.map(
      ([, options]) => JSON.parse(options.body).requestId,
    );
    expect(identifiers).toEqual([id(1), id(1)]);
  });

  it("starts a new request identity after editing a failed payload", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false }, { status: 503 }));
    render(<SupportPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "An edited synthetic support question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
    await screen.findByRole("status");
    const identifiers = fetchMock.mock.calls.map(
      ([, options]) => JSON.parse(options.body).requestId,
    );
    expect(identifiers).toEqual([id(1), id(2)]);
  });

  it.each([{ ok: false }, { ok: true }, { ok: true, reference: "" }])(
    "does not claim receipt for an incomplete or failed response: %#",
    async (response) => {
      fetchMock.mockResolvedValueOnce(Response.json(response, { status: 200 }));
      render(<SupportPage />);
      fillForm();
      fireEvent.click(screen.getByRole("button", { name: "Send support request" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("could not confirm");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Subject")).toHaveValue("A synthetic support question");
    },
  );

  it("offers the configured direct email fallback without a non-working form", () => {
    configuration.inboxEnabled = false;
    render(<SupportPage />);
    expect(screen.queryByRole("button", { name: "Send support request" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email support" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:support@example.invalid"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
