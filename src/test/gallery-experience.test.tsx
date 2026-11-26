import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalleryExperience, type GalleryItem } from "@/components/gallery/gallery-experience";
import { getGalleryFeedback, toggleGalleryLike } from "@/lib/admin.functions";

vi.mock("@/hooks/use-guest", () => ({ useGuestId: () => "00000000-0000-4000-8000-000000000099" }));
vi.mock("@/lib/admin.functions", () => ({
  getGalleryFeedback: vi.fn(),
  toggleGalleryLike: vi.fn(),
  addGalleryComment: vi.fn(async () => ({ ok: true })),
}));

const posts: GalleryItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    url: "https://media.example/first.mp4",
    media_type: "video",
    caption: "First reel",
    created_at: "2026-11-26",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    url: "https://media.example/second.mp4",
    media_type: "video",
    caption: "Second reel",
    created_at: "2026-11-26",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    url: "/photo.jpg",
    media_type: "image",
    caption: "A fresh burger",
    created_at: "2026-11-26",
  },
];

beforeEach(() => {
  vi.mocked(getGalleryFeedback).mockResolvedValue({ likeCount: 4, likedByMe: false, comments: [] });
  vi.mocked(toggleGalleryLike).mockResolvedValue({ liked: true });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
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
  vi.clearAllMocks();
});

function gallery(initialPostId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <GalleryExperience items={posts} initialPostId={initialPostId} />
    </QueryClientProvider>,
  );
  const feed = result.container.querySelector<HTMLElement>(".gallery-reel-feed");
  if (feed) {
    Object.defineProperty(feed, "clientHeight", { configurable: true, value: 500 });
    Object.defineProperty(feed, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 0, bottom: 500, height: 500 }),
    });
  }
  act(() => fireEvent.scroll(window));
  return result;
}

function scrollFeed(container: HTMLElement, top: number) {
  const feed = container.querySelector<HTMLElement>(".gallery-reel-feed")!;
  feed.scrollTop = top;
  fireEvent.scroll(feed);
}

function moveFeedOutOfView(container: HTMLElement) {
  const feed = container.querySelector<HTMLElement>(".gallery-reel-feed")!;
  Object.defineProperty(feed, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ top: -500, bottom: 0, height: 500 }),
  });
  fireEvent.scroll(window);
}

describe("Gallery browsing", () => {
  it("switches playback between visible reels and pauses while comments are open", async () => {
    const { container } = gallery();
    const videos = container.querySelectorAll("video");
    await waitFor(() => expect(videos[0]?.paused).toBe(false));
    expect(videos[1]?.paused).toBe(true);
    act(() => scrollFeed(container, 500));
    await waitFor(() => expect(videos[1]?.paused).toBe(false));
    expect(videos[0]?.paused).toBe(true);
    const second = screen.getByRole("group", { name: "Video 2: Second reel" });
    fireEvent.click(within(second).getByRole("button", { name: "View comments" }));
    expect(await screen.findByRole("dialog", { name: "Video comments" })).toBeInTheDocument();
    expect(videos[1]?.paused).toBe(true);
  });

  it("pauses a reel as soon as it leaves the visible feed", async () => {
    const { container } = gallery();
    const video = container.querySelector("video")!;
    await waitFor(() => expect(video.paused).toBe(false));

    act(() => moveFeedOutOfView(container));

    await waitFor(() => expect(video.paused).toBe(true));
  });

  it("opens a shared photo directly and lets visitors return to the grid", async () => {
    gallery(posts[2]!.id);
    expect(document.querySelector('[role="tab"][data-state="active"]')).toHaveTextContent("Photos");
    const dialog = await screen.findByRole("dialog", { name: "Gallery photo" });
    expect(within(dialog).getByRole("img", { name: "A fresh burger" })).toHaveAttribute(
      "src",
      "/photo.jpg",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Photos/ })).toHaveFocus();
  });

  it("restores focus to the photo tile after closing its viewer", async () => {
    gallery();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Photos/ }), { button: 0, ctrlKey: false });
    const tile = screen.getByRole("button", { name: "Open photo: A fresh burger" });
    fireEvent.click(tile);
    const dialog = await screen.findByRole("dialog", { name: "Gallery photo" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(tile).toHaveFocus());
  });

  it("rolls back a like when the server rejects it", async () => {
    vi.mocked(toggleGalleryLike).mockRejectedValue(new Error("Could not save like"));
    gallery();
    const first = screen.getByRole("group", { name: "Video 1: First reel" });
    const button = within(first).getByRole("button", { name: "Like this post" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(toggleGalleryLike).toHaveBeenCalledOnce());
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(within(button).getByText("4")).toBeInTheDocument();
  });
});
