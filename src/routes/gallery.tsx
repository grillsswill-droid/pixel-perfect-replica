import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Images, MessageCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useGuestId } from "@/hooks/use-guest";
import {
  addGalleryComment,
  getGalleryFeedback,
  getPublicGalleryItems,
  toggleGalleryLike,
} from "@/lib/admin.functions";
import { foodImage } from "@/lib/food-images";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery | Grill & Swill" },
      { name: "description", content: "Take a look at what's fresh off the Grill & Swill line." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getPublicGalleryItems(),
    staleTime: 60_000,
  });

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-14 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
            <Images className="h-4 w-4" /> Fresh from the grill
          </p>
          <h1 className="mt-3 font-display text-5xl font-black uppercase sm:text-7xl">
            The gallery
          </h1>
          <p className="mt-4 max-w-xl text-cream/70">
            A look at the good stuff our team makes every day.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading the gallery…</p> : null}
        {isError ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            The gallery couldn’t be loaded. Please try again later.
          </p>
        ) : null}
        {!isLoading && !isError && data.length === 0 ? (
          <div className="rounded-3xl bg-card p-10 text-center shadow-card">
            <p className="font-display text-2xl font-black uppercase">Coming fresh soon</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Our team is getting the next batch of photos ready.
            </p>
            <Button asChild variant="hero" className="mt-5">
              <Link to="/menu">
                Browse the menu <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {data.map((item) => (
            <article
              key={item.id}
              className="mb-5 break-inside-avoid overflow-hidden rounded-3xl bg-card shadow-card"
            >
              {item.media_type === "video" ? (
                foodImage(item.url) ? (
                  <video
                    src={foodImage(item.url)}
                    controls
                    preload="metadata"
                    className="max-h-[34rem] w-full bg-charcoal object-cover"
                  >
                    Your browser does not support video playback.
                  </video>
                ) : null
              ) : foodImage(item.url) ? (
                <img
                  src={foodImage(item.url)}
                  alt={item.caption || "Grill & Swill food"}
                  loading="lazy"
                  className="max-h-[34rem] w-full object-cover"
                />
              ) : null}
              {item.caption ? <p className="p-4 text-sm font-semibold">{item.caption}</p> : null}
              <GalleryFeedback itemId={item.id} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function GalleryFeedback({ itemId }: { itemId: string }) {
  const guestId = useGuestId();
  const queryClient = useQueryClient();
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [formError, setFormError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const feedbackKey = ["gallery-feedback", itemId, guestId];
  const { data, isLoading, isError } = useQuery({
    queryKey: feedbackKey,
    queryFn: () =>
      getGalleryFeedback({
        data: { item_id: itemId, ...(guestId ? { guest_id: guestId } : {}) },
      }),
    enabled: expanded,
  });
  const likeMutation = useMutation({
    mutationFn: () => {
      if (!guestId) throw new Error("Please try again in a moment.");
      return toggleGalleryLike({ data: { item_id: itemId, guest_id: guestId } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKey }),
  });
  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!guestId) throw new Error("Please try again in a moment.");
      const result = await addGalleryComment({
        data: { item_id: itemId, guest_id: guestId, author, text },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async () => {
      setText("");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: feedbackKey });
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Could not post comment."),
  });

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commentMutation.mutate();
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="flex min-h-10 cursor-pointer items-center gap-2 py-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4" />
          {data
            ? `${data.likeCount} likes · ${data.comments.length} comments`
            : "View likes and comments"}
        </summary>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!guestId || !data || likeMutation.isPending}
          aria-pressed={data?.likedByMe ?? false}
          onClick={() => likeMutation.mutate()}
        >
          <Heart className={`h-4 w-4 ${data?.likedByMe ? "fill-current text-primary" : ""}`} />
          {data?.likedByMe ? "Liked" : "Like"}
        </Button>
        {likeMutation.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {likeMutation.error instanceof Error
              ? likeMutation.error.message
              : "Could not update your like."}
          </p>
        ) : null}
        {isLoading ? <p className="py-2 text-sm text-muted-foreground">Loading comments…</p> : null}
        {isError ? (
          <p role="alert" className="py-2 text-sm text-destructive">
            Comments couldn’t be loaded. Please try again.
          </p>
        ) : null}
        <ul className="max-h-56 space-y-3 overflow-y-auto py-2">
          {(data?.comments ?? []).map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="font-semibold">{comment.author}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
                {comment.text}
              </p>
            </li>
          ))}
          {!isLoading && !isError && data?.comments.length === 0 ? (
            <li className="text-sm text-muted-foreground">Be the first to comment.</li>
          ) : null}
        </ul>
        <form onSubmit={submitComment} className="mt-2 grid gap-2">
          <label className="sr-only" htmlFor={`gallery-author-${itemId}`}>
            Your name
          </label>
          <input
            id={`gallery-author-${itemId}`}
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            minLength={2}
            maxLength={50}
            required
            placeholder="Your name"
            className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`gallery-comment-${itemId}`}>
              Write a comment
            </label>
            <input
              id={`gallery-comment-${itemId}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={1000}
              required
              placeholder="Add a comment…"
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              variant="hero"
              aria-label="Post comment"
              disabled={!guestId || commentMutation.isPending || !author.trim() || !text.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {formError ? (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Comments are public. Keep them respectful.
          </p>
        </form>
      </details>
    </div>
  );
}
