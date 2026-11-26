import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReelVideo } from "@/components/gallery/reel-video";

let reduced = false;
let visibility = "visible";

beforeEach(() => {
  reduced = false;
  visibility = "visible";
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility as DocumentVisibilityState,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function player(active = true, src = "https://media.example/video.mp4") {
  return (
    <ReelVideo src={src} caption="A fresh burger" active={active} muted onMutedChange={vi.fn()} />
  );
}

describe("Reels playback", () => {
  it("plays only when active and pauses as soon as the video leaves the view", async () => {
    const { rerender, container } = render(player(false));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    rerender(player());
    await waitFor(() => expect(container.querySelector("video")?.paused).toBe(false));
    expect(container.querySelector("video")?.muted).toBe(true);
    rerender(player(false));
    expect(container.querySelector("video")?.paused).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]!);
    expect(container.querySelector("video")?.paused).toBe(true);
  });

  it("requires explicit playback for reduced motion and preserves a user's pause", async () => {
    reduced = true;
    const { rerender, container } = render(player());
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]!);
    await waitFor(() => expect(container.querySelector("video")?.paused).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Pause video" })[0]!);
    const playCount = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    rerender(player(false));
    rerender(player());
    expect(container.querySelector("video")?.paused).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(playCount);
  });

  it("pauses a hidden browser tab and resumes the visible active video", async () => {
    const { container } = render(player());
    await waitFor(() => expect(container.querySelector("video")?.paused).toBe(false));
    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(container.querySelector("video")?.paused).toBe(true);
    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(container.querySelector("video")?.paused).toBe(false));
  });

  it("keeps a play button when a browser blocks autoplay", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new DOMException("Autoplay blocked", "NotAllowedError"),
    );
    render(player());
    await act(async () => {});
    expect(screen.getAllByRole("button", { name: "Play video" })).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resolves a Streamable share link before autoplaying the video", async () => {
    const playableUrl =
      "https://cdn-cf-east.streamable.com/video/mp4/ym4ib0.mp4?Expires=1795912179479";
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 2, files: { mp4: { url: playableUrl } } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const { container } = render(player(true, "https://streamable.com/ym4ib0"));
    const video = container.querySelector("video")!;

    await waitFor(() => expect(video).toHaveAttribute("src", playableUrl));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "https://api.streamable.com/videos/ym4ib0",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("shows a clear recovery message for a page URL that is not supported video media", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(player(true, "https://youtube.com/watch?v=abc123"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use a direct HTTPS MP4, M4V or WebM link, or a Streamable video link.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("seeks within the actual video duration", () => {
    const { container } = render(player(false));
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 42, configurable: true });
    fireEvent.loadedMetadata(video);
    const progress = screen.getByRole("slider", { name: "Video progress" });
    fireEvent.change(progress, { target: { value: "21" } });
    expect(video.currentTime).toBe(21);
    expect(progress).toHaveAttribute("aria-valuetext", "0:21 of 0:42");
  });
});
