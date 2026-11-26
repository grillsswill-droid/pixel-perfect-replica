import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addGalleryComment, getGalleryFeedback, toggleGalleryLike } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { GalleryDialog } from "./gallery-dialog";

const feedbackKey = (itemId: string, guestId: string | null) => [
  "gallery-feedback",
  itemId,
  guestId,
];

function useFeedback(itemId: string, guestId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: feedbackKey(itemId, guestId),
    queryFn: () =>
      getGalleryFeedback({ data: { item_id: itemId, ...(guestId ? { guest_id: guestId } : {}) } }),
    enabled: enabled && Boolean(guestId),
    staleTime: 30_000,
    retry: 1,
  });
}

export function GalleryPostActions({
  itemId,
  guestId,
  enabled,
  rail = false,
  onComment,
}: {
  itemId: string;
  guestId: string | null;
  enabled: boolean;
  rail?: boolean;
  onComment: (trigger: HTMLButtonElement) => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useFeedback(itemId, guestId, enabled);
  const key = feedbackKey(itemId, guestId);
  const [shareLink, setShareLink] = useState("");
  const shareTrigger = useRef<HTMLButtonElement | null>(null);
  const like = useMutation({
    mutationFn: () => {
      if (!guestId) throw new Error("Please try again in a moment.");
      return toggleGalleryLike({ data: { item_id: itemId, guest_id: guestId } });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<Awaited<ReturnType<typeof getGalleryFeedback>>>(key);
      if (previous)
        queryClient.setQueryData(key, {
          ...previous,
          likedByMe: !previous.likedByMe,
          likeCount: Math.max(0, previous.likeCount + (previous.likedByMe ? -1 : 1)),
        });
      return { previous };
    },
    onError: (reason, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Your like could not be saved. Please try again.",
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  async function share(trigger: HTMLButtonElement) {
    shareTrigger.current = trigger;
    const url = new URL("/gallery", window.location.origin);
    url.searchParams.set("post", itemId);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Grill & Swill gallery", url: url.href });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
        toast.success("Post link copied");
      } else {
        setShareLink(url.href);
      }
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      setShareLink(url.href);
    }
  }

  const actionClass = cn(
    "gallery-social-action",
    rail ? "gallery-social-action-rail" : "gallery-social-action-row",
  );
  return (
    <>
      <div
        className={cn(
          "flex",
          rail ? "flex-col gap-2 text-white" : "items-center gap-2 text-foreground",
        )}
      >
        <button
          type="button"
          className={actionClass}
          aria-label={data?.likedByMe ? "Unlike this post" : "Like this post"}
          aria-pressed={data?.likedByMe ?? false}
          disabled={!guestId || !data || like.isPending}
          onClick={() => like.mutate()}
        >
          <Heart
            className={cn("h-6 w-6", data?.likedByMe && "fill-current text-ember")}
            aria-hidden="true"
          />
          <span>{data ? data.likeCount : "Like"}</span>
        </button>
        <button
          type="button"
          className={actionClass}
          aria-label="View comments"
          onClick={(event) => onComment(event.currentTarget)}
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
          <span>{data ? data.comments.length : "Comment"}</span>
        </button>
        <button
          type="button"
          className={actionClass}
          aria-label="Share this post"
          onClick={(event) => void share(event.currentTarget)}
        >
          <Send className="h-6 w-6" aria-hidden="true" />
          <span className={rail ? "" : "sr-only"}>Share</span>
        </button>
      </div>
      <GalleryDialog
        open={Boolean(shareLink)}
        onOpenChange={(open) => {
          if (!open) setShareLink("");
        }}
        title="Share this post"
        description="Copy the link to share this gallery post."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          shareTrigger.current?.focus();
        }}
      >
        <h2 className="pr-12 font-display text-2xl font-black">Share this post</h2>
        <label className="mt-5 block text-sm font-semibold">
          Post link
          <input
            readOnly
            value={shareLink}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          />
        </label>
        <p className="mt-3 text-sm text-muted-foreground">
          Select and copy this link to share the post.
        </p>
      </GalleryDialog>
    </>
  );
}

export function GalleryComments({ itemId, guestId }: { itemId: string; guestId: string | null }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, isFetching, refetch } = useFeedback(itemId, guestId, true);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const comment = useMutation({
    mutationFn: async () => {
      if (!guestId) throw new Error("Please try again in a moment.");
      const result = await addGalleryComment({
        data: { item_id: itemId, guest_id: guestId, author: author.trim(), text: text.trim() },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async () => {
      setText("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: feedbackKey(itemId, guestId) });
      toast.success("Comment posted");
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Your comment could not be posted. Please try again.",
      ),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (author.trim().length < 2 || !text.trim()) {
      setError("Add your name (at least 2 characters) and a comment.");
      return;
    }
    setError("");
    comment.mutate();
  }

  return (
    <div className="gallery-comments">
      <h2 className="font-display text-xl font-black">
        Comments{data ? ` (${data.comments.length})` : ""}
      </h2>
      {isPending ? (
        <p role="status" className="py-5 text-sm text-muted-foreground">
          Loading comments…
        </p>
      ) : null}
      {isError ? (
        <div role="alert" className="py-4 text-sm text-destructive">
          <p>Comments couldn’t be loaded.</p>
          <Button type="button" variant="ghost" loading={isFetching} onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      <ul className="my-4 max-h-64 space-y-4 overflow-y-auto">
        {(data?.comments ?? []).map((entry) => (
          <li key={entry.id} className="text-sm">
            <p className="font-bold">{entry.author}</p>
            <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
              {entry.text}
            </p>
          </li>
        ))}
        {data?.comments.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">Be the first to comment.</li>
        ) : null}
      </ul>
      <form
        onSubmit={submit}
        className="grid gap-3 border-t border-border pt-4"
        aria-busy={comment.isPending}
      >
        <label className="text-sm font-semibold" htmlFor={`gallery-author-${itemId}`}>
          Your name
        </label>
        <input
          id={`gallery-author-${itemId}`}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          minLength={2}
          maxLength={50}
          required
          autoComplete="name"
          disabled={comment.isPending}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        />
        <label className="text-sm font-semibold" htmlFor={`gallery-comment-${itemId}`}>
          Comment
        </label>
        <textarea
          id={`gallery-comment-${itemId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          required
          rows={2}
          disabled={comment.isPending}
          aria-describedby={error ? `gallery-error-${itemId}` : undefined}
          className="min-h-20 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        {error ? (
          <p id={`gallery-error-${itemId}`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={comment.isPending}
          disabled={!guestId || !author.trim() || !text.trim()}
        >
          <Send aria-hidden="true" /> Post comment
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Comments are public. Keep them respectful.
        </p>
      </form>
    </div>
  );
}
