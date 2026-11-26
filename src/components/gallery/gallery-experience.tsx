import { ArrowDown, ArrowUp, Clapperboard, Grid3X3, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGuestId } from "@/hooks/use-guest";
import { useGalleryReducedMotion } from "@/hooks/use-gallery-media";
import { foodImage } from "@/lib/food-images";
import { GalleryDialog } from "./gallery-dialog";
import { GalleryComments, GalleryPostActions } from "./gallery-feedback";
import { ReelVideo } from "./reel-video";

export type GalleryItem = {
  id: string;
  url: string;
  media_type: "image" | "video";
  caption: string;
  created_at: string;
};

export function GalleryExperience({
  items,
  initialPostId,
}: {
  items: GalleryItem[];
  initialPostId?: string;
}) {
  const guestId = useGuestId();
  const photos = items.filter((item) => item.media_type === "image" && foodImage(item.url));
  const reels = items.filter((item) => item.media_type === "video" && foodImage(item.url));
  const initialPost = items.find((item) => item.id === initialPostId);
  const [view, setView] = useState(
    initialPost?.media_type === "image" || !reels.length ? "photos" : "reels",
  );
  const [photoId, setPhotoId] = useState<string | null>(
    initialPost?.media_type === "image" ? initialPost.id : null,
  );
  const [commentId, setCommentId] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const photosTab = useRef<HTMLButtonElement>(null);
  const photoIndex = photos.findIndex((item) => item.id === photoId);
  const photo = photos[photoIndex];
  const commentPost = items.find((item) => item.id === commentId);

  function restoreFocus(event: Event) {
    event.preventDefault();
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    else photosTab.current?.focus({ preventScroll: true });
  }

  function openPhoto(item: GalleryItem, source: HTMLElement) {
    trigger.current = source;
    setPhotoId(item.id);
  }

  return (
    <>
      <Tabs value={view} onValueChange={setView}>
        <TabsList
          aria-label="Gallery views"
          className="mb-6 h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground"
        >
          <TabsTrigger value="reels" className="gallery-view-tab">
            <Clapperboard className="h-5 w-5" aria-hidden="true" /> Reels{" "}
            <span className="text-xs tabular-nums">{reels.length}</span>
          </TabsTrigger>
          <TabsTrigger ref={photosTab} value="photos" className="gallery-view-tab">
            <Grid3X3 className="h-5 w-5" aria-hidden="true" /> Photos{" "}
            <span className="text-xs tabular-nums">{photos.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reels" className="mt-0">
          {reels.length ? (
            <ReelFeed
              items={reels}
              photos={photos}
              guestId={guestId}
              initialPostId={initialPostId}
              suspendedId={photo ? "all" : commentId}
              onComment={(id, source) => {
                trigger.current = source;
                setCommentId(id);
              }}
              onPhoto={openPhoto}
              onViewPhotos={() => setView("photos")}
            />
          ) : (
            <GalleryEmpty
              kind="reels"
              onSwitch={photos.length ? () => setView("photos") : undefined}
            />
          )}
        </TabsContent>
        <TabsContent value="photos" className="mt-0">
          {photos.length ? (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
              {photos.map((item) => (
                <button
                  key={item.id}
                  id={`gallery-photo-${item.id}`}
                  type="button"
                  aria-label={`Open photo: ${item.caption || "Grill & Swill food"}`}
                  onClick={(event) => openPhoto(item, event.currentTarget)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-charcoal sm:rounded-2xl"
                >
                  <img
                    src={foodImage(item.url)}
                    alt={item.caption || "Grill & Swill food"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/90 to-transparent px-3 pb-3 pt-8 text-left text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-sm">
                    <span className="line-clamp-2">{item.caption || "View photo"}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <GalleryEmpty
              kind="photos"
              onSwitch={reels.length ? () => setView("reels") : undefined}
            />
          )}
        </TabsContent>
      </Tabs>

      <GalleryDialog
        open={Boolean(photo)}
        onOpenChange={(open) => {
          if (!open) setPhotoId(null);
        }}
        title="Gallery photo"
        description={photo?.caption || "A closer look at a Grill & Swill photo."}
        className="max-w-5xl p-0 sm:p-0"
        onCloseAutoFocus={restoreFocus}
        onKeyDown={(event) => {
          if (isTyping(event)) return;
          if (event.key === "ArrowRight" && photoIndex < photos.length - 1) {
            event.preventDefault();
            setPhotoId(photos[photoIndex + 1]!.id);
          }
          if (event.key === "ArrowLeft" && photoIndex > 0) {
            event.preventDefault();
            setPhotoId(photos[photoIndex - 1]!.id);
          }
        }}
      >
        {photo ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative flex min-h-64 items-center justify-center bg-charcoal">
              <img
                src={foodImage(photo.url)}
                alt={photo.caption || "Grill & Swill food"}
                className="max-h-[70dvh] w-full object-contain"
              />
              {photos.length > 1 ? (
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-white">
                  <button
                    type="button"
                    className="gallery-media-button h-11 w-11"
                    aria-label="Previous photo"
                    disabled={photoIndex === 0}
                    onClick={() => setPhotoId(photos[photoIndex - 1]!.id)}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="rounded-full bg-charcoal/80 px-3 py-2 text-xs tabular-nums">
                    {photoIndex + 1} / {photos.length}
                  </span>
                  <button
                    type="button"
                    className="gallery-media-button h-11 w-11"
                    aria-label="Next photo"
                    disabled={photoIndex === photos.length - 1}
                    onClick={() => setPhotoId(photos[photoIndex + 1]!.id)}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="gallery-photo-details p-5">
              <div className="flex items-center gap-3 pr-10">
                <img src="/favicon.png" alt="" className="h-10 w-10 rounded-full" />
                <p className="font-bold">Grill & Swill</p>
              </div>
              {photo.caption ? (
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {photo.caption}
                </p>
              ) : null}
              <div className="my-3">
                <GalleryPostActions
                  itemId={photo.id}
                  guestId={guestId}
                  enabled
                  onComment={() => document.getElementById(`gallery-comment-${photo.id}`)?.focus()}
                />
              </div>
              <GalleryComments key={photo.id} itemId={photo.id} guestId={guestId} />
            </div>
          </div>
        ) : null}
      </GalleryDialog>

      <GalleryDialog
        open={Boolean(commentPost)}
        onOpenChange={(open) => {
          if (!open) setCommentId(null);
        }}
        title="Video comments"
        description="Read and add public comments on this gallery post."
        onCloseAutoFocus={restoreFocus}
      >
        {commentPost ? (
          <div className="pt-10">
            <p className="mb-5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {commentPost.caption}
            </p>
            <GalleryComments key={commentPost.id} itemId={commentPost.id} guestId={guestId} />
          </div>
        ) : null}
      </GalleryDialog>
    </>
  );
}

function ReelFeed({
  items,
  photos,
  guestId,
  initialPostId,
  suspendedId,
  onComment,
  onPhoto,
  onViewPhotos,
}: {
  items: GalleryItem[];
  photos: GalleryItem[];
  guestId: string | null;
  initialPostId?: string;
  suspendedId: string | null;
  onComment: (id: string, trigger: HTMLButtonElement) => void;
  onPhoto: (item: GalleryItem, trigger: HTMLElement) => void;
  onViewPhotos: () => void;
}) {
  const feed = useRef<HTMLDivElement>(null);
  const initialIndex = Math.max(
    0,
    items.findIndex((item) => item.id === initialPostId),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(true);
  const [feedVisible, setFeedVisible] = useState(false);
  const reduced = useGalleryReducedMotion();

  useEffect(() => {
    const node = feed.current;
    if (!node) return;

    function updateVisibility() {
      const rect = feed.current?.getBoundingClientRect();
      if (!rect) return;
      const { top, bottom, height } = rect;
      const visibleHeight = Math.max(0, Math.min(bottom, window.innerHeight) - Math.max(top, 0));
      setFeedVisible(height > 0 && visibleHeight / height >= 0.25);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  useEffect(() => {
    feed.current?.scrollTo({ top: initialIndex * feed.current.clientHeight, behavior: "auto" });
  }, [initialIndex]);

  function goTo(index: number, keyboard = false) {
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    feed.current?.scrollTo({
      top: clamped * feed.current.clientHeight,
      behavior: reduced || keyboard ? "auto" : "smooth",
    });
    if (keyboard) {
      feed.current?.children[clamped]
        ?.querySelector<HTMLButtonElement>("[data-gallery-play]")
        ?.focus({ preventScroll: true });
    }
  }

  return (
    <div className="gallery-reel-layout mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
      <div className="gallery-reel-column mx-auto w-full max-w-[28rem]">
        <div
          ref={feed}
          tabIndex={0}
          aria-label="Video feed. Scroll or use the up and down arrow keys to browse."
          className="gallery-reel-feed"
          onScroll={(event) => {
            const height = event.currentTarget.clientHeight;
            if (!height) return;
            setActiveIndex(
              Math.max(
                0,
                Math.min(items.length - 1, Math.round(event.currentTarget.scrollTop / height)),
              ),
            );
          }}
          onKeyDown={(event) => {
            if (isTyping(event)) return;
            if (event.key === "ArrowDown" || event.key === "PageDown") {
              event.preventDefault();
              goTo(activeIndex + 1, true);
            }
            if (event.key === "ArrowUp" || event.key === "PageUp") {
              event.preventDefault();
              goTo(activeIndex - 1, true);
            }
          }}
        >
          {items.map((item, index) => (
            <ReelSlide
              key={item.id}
              item={item}
              index={index}
              current={activeIndex === index}
              guestId={guestId}
              muted={muted}
              onMutedChange={setMuted}
              feedVisible={feedVisible}
              suspended={suspendedId === "all" || suspendedId === item.id}
              onComment={onComment}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scroll or swipe for the next video</p>
          <span className="shrink-0 text-xs font-semibold tabular-nums">
            {activeIndex + 1} / {items.length}
          </span>
        </div>
        <div className="mt-3 flex justify-center gap-3 lg:hidden">
          <Button
            type="button"
            variant="secondary"
            aria-label="Previous video"
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
          >
            <ArrowUp aria-hidden="true" /> Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label="Next video"
            disabled={activeIndex === items.length - 1}
            onClick={() => goTo(activeIndex + 1)}
          >
            Next <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </div>
      <aside className="hidden pt-8 lg:block">
        <img src="/favicon.png" alt="" className="h-16 w-16" />
        <h2 className="mt-5 font-display text-3xl font-black uppercase">Fresh off the grill</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Food, packaging and moments from the Grill & Swill line. Scroll to watch, or use the
          arrows below.
        </p>
        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 sm:h-11 sm:w-11"
            aria-label="Previous video"
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 sm:h-11 sm:w-11"
            aria-label="Next video"
            disabled={activeIndex === items.length - 1}
            onClick={() => goTo(activeIndex + 1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
        {photos.length ? (
          <div className="mt-10 border-t border-border pt-5">
            <p className="mb-3 text-sm font-bold">More from the gallery</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Open photo: ${item.caption || "Grill & Swill food"}`}
                  className="group aspect-square cursor-pointer overflow-hidden rounded-lg bg-card"
                  onClick={(event) => onPhoto(item, event.currentTarget)}
                >
                  <img
                    src={foodImage(item.url)}
                    alt={item.caption || "Grill & Swill food"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform motion-safe:group-hover:scale-[1.03]"
                  />
                </button>
              ))}
            </div>
            <Button type="button" variant="link" className="mt-3 px-0" onClick={onViewPhotos}>
              View all photos
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function ReelSlide({
  item,
  index,
  current,
  guestId,
  muted,
  onMutedChange,
  feedVisible,
  suspended,
  onComment,
}: {
  item: GalleryItem;
  index: number;
  current: boolean;
  guestId: string | null;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  feedVisible: boolean;
  suspended: boolean;
  onComment: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="gallery-reel-slide"
      role="group"
      aria-label={`Video ${index + 1}: ${item.caption || "Grill & Swill"}`}
    >
      <ReelVideo
        src={foodImage(item.url)}
        caption={item.caption}
        active={feedVisible && current && !suspended}
        muted={muted}
        onMutedChange={onMutedChange}
      >
        <div className="gallery-reel-actions absolute bottom-20 right-3 z-10">
          <GalleryPostActions
            itemId={item.id}
            guestId={guestId}
            enabled={(feedVisible && current) || suspended}
            rail
            onComment={(source) => onComment(item.id, source)}
          />
        </div>
        <div className="gallery-reel-caption absolute bottom-18 left-4 right-20 z-10 text-white">
          <div className="mb-3 flex items-center gap-2">
            <img src="/favicon.png" alt="" className="h-9 w-9 rounded-full bg-charcoal" />
            <p className="text-sm font-bold">Grill & Swill</p>
          </div>
          {item.caption ? (
            <p className="max-h-36 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words text-sm leading-relaxed">
              {expanded || item.caption.length <= 100
                ? item.caption
                : `${item.caption.slice(0, 100)}…`}
            </p>
          ) : null}
          {item.caption.length > 100 ? (
            <button
              type="button"
              className="mt-1 min-h-11 cursor-pointer text-xs font-bold underline"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      </ReelVideo>
    </div>
  );
}

function GalleryEmpty({ kind, onSwitch }: { kind: "photos" | "reels"; onSwitch?: () => void }) {
  const Icon = kind === "reels" ? Clapperboard : Grid3X3;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <Icon className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
      <h2 className="font-display text-2xl font-black uppercase">
        {kind === "reels" ? "Reels are coming soon" : "Photos are coming soon"}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Our team is getting the next batch ready.
      </p>
      {onSwitch ? (
        <Button type="button" variant="secondary" className="mt-5" onClick={onSwitch}>
          {kind === "reels" ? "Browse photos" : "Watch reels"}
        </Button>
      ) : null}
    </div>
  );
}

function isTyping(event: KeyboardEvent<HTMLElement>) {
  const element = event.target as HTMLElement;
  return element.matches("input, textarea, select") || element.isContentEditable;
}
