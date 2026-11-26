import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAdminSupportInbox: vi.fn(),
  getAdminSupportRequest: vi.fn(),
  replyAdminSupportRequest: vi.fn(),
  retryAdminSupportNotification: vi.fn(),
  setAdminSupportStatus: vi.fn(),
}));
vi.mock("@/lib/support.functions", () => api);

import { AdminSupportPanel } from "@/components/customer/admin-support-panel";
import type { SupportRequestDetail } from "@/lib/support-types";

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const timestamp = "2026-11-26T00:00:00.000Z";
const request = (number = 1): SupportRequestDetail => ({
  id: id(number),
  reference: `GS-${id(number).toUpperCase()}`,
  name: "Synthetic Customer",
  email: "synthetic@example.invalid",
  subject: "Synthetic <script>markup</script> question",
  topic: "order_issue",
  status: "new",
  orderReference: "GS-000123",
  messagePreview: "Harmless synthetic customer message.",
  notificationDelivery: "not_configured",
  createdAt: timestamp,
  updatedAt: timestamp,
  message: "Harmless <img src=x onerror=synthetic()> customer message.",
  replies: [],
});
let clipboardDescriptor: PropertyDescriptor | undefined;
let copy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.getAdminSupportInbox.mockResolvedValue({
    requests: [request()],
    nextCursor: null,
    emailDeliveryEnabled: false,
  });
  api.getAdminSupportRequest.mockResolvedValue({ request: request(), emailDeliveryEnabled: false });
  api.replyAdminSupportRequest.mockImplementation(async ({ data }) => ({
    ok: true,
    reply: {
      id: data.replyId,
      message: data.message,
      delivery: "not_configured",
      deliveryCode: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }));
  let sequence = 10;
  vi.stubGlobal("crypto", { randomUUID: () => id(++sequence) });
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  copy = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
});

afterEach(() => {
  cleanup();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AdminSupportPanel />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

async function openRequest() {
  fireEvent.click(await screen.findByRole("button", { name: /Open GS-/ }));
  await screen.findByLabelText("Your reply");
}

describe("Administrative support UI", () => {
  it("explains an empty inbox and gives a useful refresh recovery path", async () => {
    api.getAdminSupportInbox.mockResolvedValue({
      requests: [],
      nextCursor: null,
      emailDeliveryEnabled: false,
    });
    show();
    expect(await screen.findByText("No new requests.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(api.getAdminSupportRequest).not.toHaveBeenCalled();
  });

  it("announces inbox failure without exposing internal error text", async () => {
    api.getAdminSupportInbox.mockRejectedValue(new Error("synthetic-sensitive-storage-error"));
    const { container } = show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The inbox could not be refreshed");
    expect(container).not.toHaveTextContent("synthetic-sensitive-storage-error");
  });

  it("loads another cursor page and displays customer markup as text", async () => {
    const cursor = { createdAt: timestamp, id: id(1) };
    api.getAdminSupportInbox.mockImplementation(async ({ data }) =>
      data.before
        ? { requests: [request(2)], nextCursor: null, emailDeliveryEnabled: false }
        : { requests: [request(1)], nextCursor: cursor, emailDeliveryEnabled: false },
    );
    const { container } = show();
    fireEvent.click(await screen.findByRole("button", { name: "Load more requests" }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Open GS-/ })).toHaveLength(2),
    );
    expect(api.getAdminSupportInbox.mock.calls[1]![0].data.before).toEqual(cursor);
    expect(container.querySelector("script")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Open GS-/ })[0]!);
    await screen.findByLabelText("Your reply");
    expect(screen.getByText(request().message)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("preserves a failed reply's identifier/message and reports saved-but-unsent truthfully", async () => {
    api.replyAdminSupportRequest.mockRejectedValueOnce(new Error("Synthetic network failure"));
    show();
    await openRequest();
    fireEvent.change(screen.getByLabelText("Your reply"), {
      target: { value: "A harmless synthetic staff reply." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is still here");
    expect(screen.getByLabelText("Your reply")).toHaveValue("A harmless synthetic staff reply.");
    fireEvent.click(screen.getByRole("button", { name: "Save reply" }));
    expect(
      await screen.findByText(/Reply saved\. Email delivery is not configured/),
    ).toBeInTheDocument();
    const first = api.replyAdminSupportRequest.mock.calls[0]![0].data;
    const second = api.replyAdminSupportRequest.mock.calls[1]![0].data;
    expect(second).toEqual(first);
    expect(second.replyId).toBe(id(11));
    expect(second.message).toBe("A harmless synthetic staff reply.");
  });

  it("copies a draft without sending mail or marking a reply/status as sent", async () => {
    show();
    await openRequest();
    fireEvent.change(screen.getByLabelText("Your reply"), {
      target: { value: "A harmless manually copied reply." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
    expect(
      await screen.findByText("Reply copied. No email was sent or marked Sent."),
    ).toBeInTheDocument();
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("A harmless manually copied reply."));
    expect(api.replyAdminSupportRequest).not.toHaveBeenCalled();
    expect(api.setAdminSupportStatus).not.toHaveBeenCalled();
    expect(api.retryAdminSupportNotification).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Open email app" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:synthetic%40example.invalid"),
    );
  });

  it("removes private support query data when the panel unmounts", async () => {
    const { client, unmount } = show();
    await openRequest();
    expect(client.getQueryCache().findAll({ queryKey: ["admin-support"] }).length).toBeGreaterThan(
      0,
    );
    unmount();
    expect(client.getQueryCache().findAll({ queryKey: ["admin-support"] })).toHaveLength(0);
  });
});
