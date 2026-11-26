import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalleryPanel } from "@/routes/admin";
import {
  saveAdminGalleryItem,
  uploadAdminImage,
  type AdminWorkspaceData,
} from "@/lib/admin.functions";

vi.mock("@/lib/admin.functions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin.functions")>()),
  saveAdminGalleryItem: vi.fn(),
  uploadAdminImage: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(uploadAdminImage).mockResolvedValue({ url: "/api/media/000000000000000000000001" });
  vi.mocked(saveAdminGalleryItem).mockResolvedValue({ ok: true });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:local-photo"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const runAction = vi.fn(async (action: () => Promise<unknown>) => {
    try {
      await action();
      return true;
    } catch {
      return false;
    }
  });
  render(
    <QueryClientProvider client={client}>
      <GalleryPanel
        data={{ gallery: [] } as unknown as AdminWorkspaceData}
        runAction={runAction}
        busy={false}
      />
    </QueryClientProvider>,
  );
  return { runAction, client };
}

function choosePhoto() {
  const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], "my-photo.jpg", {
    type: "image/jpeg",
  });
  fireEvent.change(screen.getByLabelText("Choose a gallery photo"), { target: { files: [photo] } });
}

describe("Publishing a gallery photo", () => {
  it("previews a local file and publishes its uploaded URL without asking for an image URL", async () => {
    const { client } = panel();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    choosePhoto();
    expect(await screen.findByRole("img", { name: "Photo preview" })).toHaveAttribute(
      "src",
      "blob:local-photo",
    );
    fireEvent.change(screen.getByLabelText(/Caption/), {
      target: { value: "Fresh off the grill" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish gallery item" }));
    await waitFor(() =>
      expect(saveAdminGalleryItem).toHaveBeenCalledWith({
        data: {
          url: "/api/media/000000000000000000000001",
          media_type: "image",
          caption: "Fresh off the grill",
          active: true,
        },
      }),
    );
    expect(uploadAdminImage).toHaveBeenCalledWith({
      data: { dataUrl: "data:image/jpeg;base64,/9j/AQID" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Upload from computer/ })).toBeInTheDocument(),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["gallery"] });
  });

  it("retries a failed publish using the already uploaded photo", async () => {
    vi.mocked(saveAdminGalleryItem).mockRejectedValueOnce(new Error("Temporary publish failure"));
    const { runAction } = panel();
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Publish gallery item" }));
    await waitFor(() => expect(saveAdminGalleryItem).toHaveBeenCalledOnce());
    await waitFor(() => expect(runAction.mock.results[0]?.value).resolves.toBe(false));
    expect(screen.getByRole("img", { name: "Photo preview" })).toHaveAttribute(
      "src",
      "/api/media/000000000000000000000001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish gallery item" }));
    await waitFor(() => expect(saveAdminGalleryItem).toHaveBeenCalledTimes(2));
    expect(uploadAdminImage).toHaveBeenCalledOnce();
  });

  it("blocks an empty post before making a server request", () => {
    const { runAction } = panel();
    fireEvent.click(screen.getByRole("button", { name: "Publish gallery item" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a photo from your computer");
    expect(runAction).not.toHaveBeenCalled();
    expect(uploadAdminImage).not.toHaveBeenCalled();
  });
});
