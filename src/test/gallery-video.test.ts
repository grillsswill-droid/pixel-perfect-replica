import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGalleryVideoUrlError,
  getStreamableVideoId,
  isDirectGalleryVideoUrl,
  isGalleryVideoUrl,
  resolveGalleryVideoUrl,
} from "@/lib/gallery-video";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gallery video links", () => {
  it("recognizes Streamable share and embed links without accepting lookalike hosts", () => {
    expect(getStreamableVideoId("https://streamable.com/ym4ib0")).toBe("ym4ib0");
    expect(getStreamableVideoId("https://www.streamable.com/e/ym4ib0")).toBe("ym4ib0");
    expect(getStreamableVideoId("https://streamable.com/o/ym4ib0")).toBe("ym4ib0");
    expect(getStreamableVideoId("https://streamable.com.evil.test/ym4ib0")).toBeNull();
    expect(getStreamableVideoId("http://streamable.com/ym4ib0")).toBeNull();
  });

  it("accepts only HTTPS direct video files or supported Streamable links", () => {
    expect(isDirectGalleryVideoUrl("https://cdn.example/video.mp4?token=abc")).toBe(true);
    expect(isDirectGalleryVideoUrl("https://cdn.example/video.webm")).toBe(true);
    expect(isDirectGalleryVideoUrl("https://cdn.example/video.jpg")).toBe(false);
    expect(isDirectGalleryVideoUrl("http://cdn.example/video.mp4")).toBe(false);
    expect(isGalleryVideoUrl("https://streamable.com/ym4ib0")).toBe(true);
    expect(isGalleryVideoUrl("https://youtube.com/watch?v=ym4ib0")).toBe(false);
    expect(getGalleryVideoUrlError()).toContain("Streamable video link");
  });

  it("resolves a Streamable share link to its current MP4 URL", async () => {
    const playableUrl =
      "https://cdn-cf-east.streamable.com/video/mp4/ym4ib0.mp4?Expires=1795912179479";
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 2, files: { mp4: { url: playableUrl } } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(resolveGalleryVideoUrl("https://streamable.com/ym4ib0")).resolves.toBe(
      playableUrl,
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.streamable.com/videos/ym4ib0",
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    );
  });

  it("rejects unready or unsafe media URLs returned by the provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 2, files: { mp4: { url: "https://evil.example/file.mp4" } } }),
            { headers: { "content-type": "application/json" } },
          ),
        ),
    );
    await expect(resolveGalleryVideoUrl("https://streamable.com/ym4ib0")).rejects.toThrow(
      "unsupported video link",
    );
  });
});
