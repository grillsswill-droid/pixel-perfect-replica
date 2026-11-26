import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareGalleryImage, validateGalleryImage } from "@/lib/gallery-image";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Gallery photos from a computer", () => {
  it("keeps a small photo's bytes and format for the existing upload endpoint", async () => {
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    });
    expect(await prepareGalleryImage(photo)).toBe("data:image/jpeg;base64,/9j/AQID");
  });

  it("rejects unsupported, empty and oversized files before uploading", () => {
    expect(() =>
      validateGalleryImage(new File(["text"], "photo.svg", { type: "image/svg+xml" })),
    ).toThrow("JPEG, PNG or WebP");
    expect(() => validateGalleryImage(new File([], "empty.png", { type: "image/png" }))).toThrow(
      "empty",
    );
    const photo = new File(["photo"], "too-big.jpg", { type: "image/jpeg" });
    Object.defineProperty(photo, "size", { value: 20_000_001 });
    expect(() => validateGalleryImage(photo)).toThrow("20 MB");
  });

  it("resizes a large photo to fit the unchanged 2 MB server limit and releases the preview URL", async () => {
    const createObjectURL = vi.fn(() => "blob:large-photo");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = revokeObjectURL;
      },
    );
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 6000;
        naturalHeight = 4000;
        onload?: () => void;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      expect(this.width).toBe(2400);
      expect(this.height).toBe(1600);
      callback(new Blob([new Uint8Array([82, 73, 70, 70])], { type: "image/webp" }));
    });
    const photo = new File(["photo"], "large.png", { type: "image/png" });
    Object.defineProperty(photo, "size", { value: 8_000_000 });
    expect(await prepareGalleryImage(photo)).toBe("data:image/webp;base64,UklGRg==");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(toBlob).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:large-photo");
  });

  it("releases the object URL when a large photo cannot be decoded", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = () => "blob:broken";
        static override revokeObjectURL = revokeObjectURL;
      },
    );
    vi.stubGlobal(
      "Image",
      class {
        onerror?: () => void;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const photo = new File(["broken"], "broken.png", { type: "image/png" });
    Object.defineProperty(photo, "size", { value: 3_000_000 });
    await expect(prepareGalleryImage(photo)).rejects.toThrow("could not be opened");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:broken");
  });
});
