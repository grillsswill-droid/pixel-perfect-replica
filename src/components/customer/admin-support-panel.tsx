import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Mail, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminSupportInbox,
  getAdminSupportRequest,
  replyAdminSupportRequest,
  retryAdminSupportNotification,
  setAdminSupportStatus,
} from "@/lib/support.functions";
import {
  SUPPORT_STATUSES,
  supportReplySchema,
  type SupportDelivery,
  type SupportInboxCursor,
  type SupportReply,
  type SupportRequestDetail,
  type SupportStatus,
  type SupportTopic,
} from "@/lib/support-types";
import { cn } from "@/lib/utils";

const SUPPORT_QUERY_KEY = ["admin-support"] as const;
const STATUS_LABELS: Record<SupportStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  spam: "Spam",
};
const TOPIC_LABELS: Record<SupportTopic, string> = {
  order_issue: "Order issue",
  payment: "Payment",
  cancellation_refund: "Cancellation or refund",
  delivery_pickup: "Delivery or pickup",
  food_allergy: "Food or allergy concern",
  rewards: "Rewards",
  catering: "Catering",
  privacy: "Privacy request",
  accessibility: "Accessibility",
  website: "Website",
  other: "General help",
};
const DELIVERY_LABELS: Record<SupportDelivery, string> = {
  not_configured: "Not configured",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};
const EMPTY_DRAFT: ReplyDraft = { message: "" };

type ReplyDraft = { message: string; replyId?: string; boundMessage?: string };
type Filter = SupportStatus | "all";

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isSessionError(error: unknown) {
  return error instanceof Error && error.message === "Administrator access is required.";
}

function actionError(error: unknown) {
  if (isSessionError(error)) return "Your admin session has ended. Sign in again to continue.";
  if (
    error instanceof Error &&
    [
      "This support request is unavailable.",
      "The request changed in another session. Refresh and try again.",
      "This support request is unavailable for replies.",
      "Start a new reply after changing the message.",
      "This request has reached its reply limit.",
      "The reply changed. Refresh and try again.",
    ].includes(error.message)
  ) {
    return error.message;
  }
  return "That action could not be confirmed. Your draft is still here. Refresh before retrying.";
}

function deliveryFeedback(label: string, delivery: SupportDelivery) {
  switch (delivery) {
    case "sent":
      return `${label} accepted by the email service. This does not confirm inbox delivery.`;
    case "not_configured":
      return `${label} saved. Email delivery is not configured; copy the reply or use your email app.`;
    case "queued":
      return `${label} saved and queued for email. Refresh to check its status.`;
    case "sending":
      return `${label} is being sent. Refresh to check its status.`;
    case "failed":
      return `${label} saved, but email delivery failed or could not be confirmed. Review the delivery history before retrying.`;
  }
}

function DeliveryState({ delivery }: { delivery: SupportDelivery }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold",
        delivery === "sent" && "bg-primary/10 text-primary",
        delivery === "failed" && "bg-destructive/10 text-destructive",
      )}
    >
      {DELIVERY_LABELS[delivery]}
    </span>
  );
}

/** Mounted inside the existing authenticated admin workspace; all RPCs enforce admin access. */
export function AdminSupportPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({});
  const mounted = useRef(true);
  const detailId = useId();
  const filterId = useId();

  const inbox = useInfiniteQuery({
    queryKey: [...SUPPORT_QUERY_KEY, "inbox", filter],
    initialPageParam: undefined as SupportInboxCursor | undefined,
    queryFn: ({ pageParam }) =>
      getAdminSupportInbox({
        data: {
          limit: 25,
          ...(filter === "all" ? {} : { status: filter }),
          ...(pageParam ? { before: pageParam } : {}),
        },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const detail = useQuery({
    queryKey: [...SUPPORT_QUERY_KEY, "request", selectedId],
    queryFn: () => getAdminSupportRequest({ data: { id: selectedId! } }),
    enabled: selectedId !== null,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const requests = useMemo(
    () => [
      ...new Map(
        inbox.data?.pages.flatMap((page) => page.requests).map((item) => [item.id, item]),
      ).values(),
    ],
    [inbox.data],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void queryClient.cancelQueries({ queryKey: SUPPORT_QUERY_KEY });
      queryClient.removeQueries({ queryKey: SUPPORT_QUERY_KEY });
    };
  }, [queryClient]);

  const updateDraft = useCallback((id: string, draft: ReplyDraft) => {
    setDrafts((current) => ({ ...current, [id]: draft }));
  }, []);
  const refreshAfterAction = useCallback(async () => {
    if (mounted.current) {
      await queryClient.invalidateQueries({ queryKey: SUPPORT_QUERY_KEY });
    }
  }, [queryClient]);

  function closeRequest() {
    const previousId = selectedId;
    setSelectedId(null);
    window.requestAnimationFrame(() =>
      (
        document.getElementById(`support-case-${previousId}`) ?? document.getElementById(filterId)
      )?.focus(),
    );
  }

  const sessionExpired = isSessionError(inbox.error) || isSessionError(detail.error);
  const emailEnabled =
    detail.data?.emailDeliveryEnabled ?? inbox.data?.pages[0]?.emailDeliveryEnabled;

  return (
    <section
      className="min-w-0 rounded-3xl bg-card p-5 shadow-card sm:p-7"
      aria-labelledby="support-inbox-title"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h2
            id="support-inbox-title"
            className="font-display text-2xl font-black uppercase sm:text-3xl"
          >
            Customer support
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review customer requests, update their status and keep replies with the case.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={inbox.isFetching || (selectedId !== null && detail.isFetching)}
          onClick={() => {
            void inbox.refetch();
            if (selectedId) void detail.refetch();
          }}
        >
          <RefreshCw aria-hidden="true" /> Refresh
        </Button>
      </div>

      {emailEnabled === false ? (
        <p className="mb-5 rounded-xl bg-muted p-4 text-sm leading-6">
          Email delivery is not configured. Requests are available here; save a reply, then copy it
          or open your email app.
        </p>
      ) : null}
      {sessionExpired ? (
        <p role="alert" className="text-sm text-destructive">
          Your admin session has ended. Sign in again to view support requests.
        </p>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-0 lg:divide-x lg:divide-border">
          <div className={cn("min-w-0 lg:pr-6", selectedId && "hidden lg:block")}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="w-full max-w-56">
                <label htmlFor={filterId} className="mb-2 block text-sm font-semibold">
                  Request status
                </label>
                <Select
                  value={filter}
                  onValueChange={(value) => {
                    if (value === "all" || SUPPORT_STATUSES.includes(value as SupportStatus)) {
                      setFilter(value as Filter);
                      setSelectedId(null);
                    }
                  }}
                >
                  <SelectTrigger id={filterId} className="h-11 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {SUPPORT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p role="status" aria-atomic="true" className="text-xs text-muted-foreground">
                {inbox.isPending
                  ? "Loading requests…"
                  : `${requests.length} ${requests.length === 1 ? "request" : "requests"} loaded`}
              </p>
            </div>

            {inbox.isPending ? (
              <div className="space-y-5 py-4" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="space-y-2">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : null}
            {inbox.isError ? (
              <p role="alert" className="mb-4 text-sm leading-6 text-destructive">
                The inbox could not be refreshed.{" "}
                {inbox.data ? "Existing results may be out of date. " : ""}Use Refresh to try again.
              </p>
            ) : null}
            {requests.length > 0 ? (
              <ul
                className="divide-y divide-border"
                aria-label="Support requests"
                aria-busy={inbox.isFetching}
              >
                {requests.map((request) => (
                  <li key={request.id}>
                    <button
                      id={`support-case-${request.id}`}
                      type="button"
                      aria-label={`Open ${request.reference}: ${request.subject}`}
                      aria-pressed={selectedId === request.id}
                      aria-controls={detailId}
                      onClick={() => setSelectedId(request.id)}
                      className={cn(
                        "block w-full min-w-0 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                        selectedId === request.id && "bg-primary/10",
                      )}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">{request.reference}</span>
                        <span
                          className={cn(
                            "font-semibold",
                            request.status === "new" ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {STATUS_LABELS[request.status]}
                        </span>
                      </span>
                      <span className="mt-2 block break-words font-semibold [overflow-wrap:anywhere]">
                        {request.subject}
                      </span>
                      <span className="mt-1 block break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {request.name} · {request.email}
                      </span>
                      <span className="mt-2 block break-words text-sm leading-6 [overflow-wrap:anywhere]">
                        {request.messagePreview}
                        {request.messagePreview.length === 160 ? "…" : ""}
                      </span>
                      <span className="mt-3 block text-xs text-muted-foreground">
                        {TOPIC_LABELS[request.topic]} ·{" "}
                        <time dateTime={request.createdAt}>{formattedDate(request.createdAt)}</time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : !inbox.isPending && !inbox.isError ? (
              <div className="py-10 text-sm leading-6 text-muted-foreground">
                <p className="font-semibold text-foreground">
                  No {filter === "all" ? "support" : STATUS_LABELS[filter].toLowerCase()} requests.
                </p>
                <p className="mt-2">
                  Choose another status or refresh to check for new customer messages.
                </p>
              </div>
            ) : null}
            {inbox.hasNextPage ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-5 w-full"
                loading={inbox.isFetchingNextPage}
                disabled={inbox.isFetching && !inbox.isFetchingNextPage}
                onClick={() => void inbox.fetchNextPage()}
              >
                Load more requests
              </Button>
            ) : null}
          </div>

          <div id={detailId} className="min-w-0 lg:pl-6">
            {selectedId ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-4"
                  onClick={closeRequest}
                >
                  <ArrowLeft aria-hidden="true" /> Back to requests
                </Button>
                {detail.isPending ? (
                  <p role="status" className="py-8 text-sm text-muted-foreground">
                    Opening the request…
                  </p>
                ) : null}
                {detail.isError ? (
                  <p role="alert" className="text-sm leading-6 text-destructive">
                    This request could not be loaded. Use Refresh to try again. Your draft is
                    preserved while this panel is open.
                  </p>
                ) : null}
                {!detail.isPending && !detail.isError && !detail.data?.request ? (
                  <p role="status" className="py-8 text-sm text-muted-foreground">
                    This request is no longer available. Choose another request.
                  </p>
                ) : null}
                {!detail.isError && detail.data?.request ? (
                  <SupportCase
                    key={detail.data.request.id}
                    request={detail.data.request}
                    emailEnabled={detail.data.emailDeliveryEnabled}
                    draft={drafts[detail.data.request.id] ?? EMPTY_DRAFT}
                    onDraftChange={updateDraft}
                    onChanged={refreshAfterAction}
                  />
                ) : null}
              </>
            ) : (
              <div className="py-10 text-sm leading-6 text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground">
                  Open a request to get started
                </h3>
                <p className="mt-2">
                  Read the customer's message, check delivery history, then reply or update its
                  status.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SupportCase({
  request,
  emailEnabled,
  draft,
  onDraftChange,
  onChanged,
}: {
  request: SupportRequestDetail;
  emailEnabled: boolean;
  draft: ReplyDraft;
  onDraftChange: (id: string, draft: ReplyDraft) => void;
  onChanged: () => Promise<void>;
}) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const errorRegion = useRef<HTMLParagraphElement>(null);
  const active = useRef(true);
  const replyId = useId();
  const statusId = useId();

  useEffect(() => {
    active.current = true;
    heading.current?.focus({ preventScroll: true });
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (error) errorRegion.current?.focus();
  }, [error]);

  const beginAction = () => {
    if (active.current) {
      setError("");
      setNotice("");
    }
  };

  const fail = (reason: unknown) => {
    if (active.current) {
      setError(actionError(reason));
      setNotice("");
    }
  };
  const status = useMutation({
    onMutate: beginAction,
    mutationFn: (value: SupportStatus) =>
      setAdminSupportStatus({ data: { id: request.id, status: value } }),
    onSuccess: async (result) => {
      if (active.current) {
        setError("");
        setNotice(`Request status updated to ${STATUS_LABELS[result.status]}.`);
      }
      await onChanged();
    },
    onError: fail,
  });
  const reply = useMutation({
    onMutate: beginAction,
    mutationFn: (data: { id: string; replyId: string; message: string }) =>
      replyAdminSupportRequest({ data }),
    onSuccess: async (result) => {
      if (active.current) {
        onDraftChange(request.id, { message: "" });
        setError("");
        setNotice(deliveryFeedback("Reply", result.reply.delivery));
      }
      await onChanged();
    },
    onError: fail,
  });
  const retryReply = useMutation({
    onMutate: beginAction,
    mutationFn: (saved: SupportReply) =>
      replyAdminSupportRequest({
        data: { id: request.id, replyId: saved.id, message: saved.message },
      }),
    onSuccess: async (result) => {
      if (active.current) {
        setError("");
        setNotice(deliveryFeedback("Reply", result.reply.delivery));
      }
      await onChanged();
    },
    onError: fail,
  });
  const notification = useMutation({
    onMutate: beginAction,
    mutationFn: () => retryAdminSupportNotification({ data: { id: request.id } }),
    onSuccess: async (result) => {
      if (active.current) {
        setError("");
        setNotice(deliveryFeedback("Inbox email", result.delivery));
      }
      await onChanged();
    },
    onError: fail,
  });
  const busy =
    status.isPending || reply.isPending || retryReply.isPending || notification.isPending;
  const spam = request.status === "spam";

  function manualBody(message: string) {
    return `${message.trim()}\n\nSupport reference: ${request.reference}`;
  }
  function emailLink(message: string) {
    return `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(`Grill & Swill support: ${request.reference}`)}&body=${encodeURIComponent(manualBody(message))}`;
  }
  async function copyMessage(message: string, selectComposer = false) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(manualBody(message));
      if (active.current) {
        setError("");
        setNotice("Reply copied. No email was sent or marked Sent.");
      }
    } catch {
      if (!active.current) return;
      if (selectComposer) {
        textarea.current?.focus();
        textarea.current?.select();
      }
      setError("");
      setNotice(
        selectComposer
          ? "Automatic copying is unavailable. The draft is selected so you can copy it manually."
          : "Automatic copying is unavailable. Select the saved reply text to copy it manually.",
      );
    }
  }
  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || spam) return;
    const nextId = draft.replyId ?? crypto.randomUUID();
    const parsed = supportReplySchema.safeParse({
      id: request.id,
      replyId: nextId,
      message: draft.message,
    });
    if (!parsed.success) {
      setFieldError(
        "Write a reply of 10–4,000 characters, without unsupported control characters.",
      );
      textarea.current?.focus();
      return;
    }
    onDraftChange(request.id, { ...draft, replyId: nextId, boundMessage: parsed.data.message });
    setFieldError("");
    setError("");
    setNotice("");
    reply.mutate(parsed.data);
  }

  return (
    <div className="min-w-0">
      <h3
        ref={heading}
        tabIndex={-1}
        className="break-words text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [overflow-wrap:anywhere]"
      >
        {request.subject}
      </h3>
      <p className="mt-2 text-sm font-semibold">
        {request.reference} · {TOPIC_LABELS[request.topic]}
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="mt-1 break-words [overflow-wrap:anywhere]">
            {request.name}
            <br />
            {request.email}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Received</dt>
          <dd className="mt-1">
            <time dateTime={request.createdAt}>{formattedDate(request.createdAt)}</time>
          </dd>
        </div>
        {request.orderReference ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground">Order or payment reference</dt>
            <dd className="mt-1 break-words [overflow-wrap:anywhere]">{request.orderReference}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="mt-1">
            <time dateTime={request.updatedAt}>{formattedDate(request.updatedAt)}</time>
          </dd>
        </div>
      </dl>
      <div className="mt-5 max-w-56">
        <label htmlFor={statusId} className="mb-2 block text-sm font-semibold">
          Case status
        </label>
        <Select
          value={request.status}
          disabled={busy}
          onValueChange={(value) => {
            if (SUPPORT_STATUSES.includes(value as SupportStatus))
              status.mutate(value as SupportStatus);
          }}
        >
          <SelectTrigger id={statusId} className="h-11 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status.isPending ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Updating case status…
          </p>
        ) : null}
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <h4 className="text-sm font-semibold">Customer message</h4>
        <p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]">
          {request.message}
        </p>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Inbox email notification</h4>
            <DeliveryState delivery={request.notificationDelivery} />
          </div>
          {!["sent", "sending"].includes(request.notificationDelivery) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || spam || !emailEnabled}
              loading={notification.isPending}
              onClick={() => notification.mutate()}
            >
              Retry inbox email
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Sent means accepted by the email service, not guaranteed inbox delivery or a customer
          response. Refresh to check queued or sending messages.
        </p>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <h4 className="font-semibold">Reply history</h4>
        {!request.replies.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No replies saved yet. Start a reply below.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {request.replies.map((saved) => (
              <li key={saved.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time dateTime={saved.createdAt} className="text-xs text-muted-foreground">
                    {formattedDate(saved.createdAt)}
                  </time>
                  <DeliveryState delivery={saved.delivery} />
                </div>
                <p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]">
                  {saved.message}
                </p>
                {saved.updatedAt !== saved.createdAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated <time dateTime={saved.updatedAt}>{formattedDate(saved.updatedAt)}</time>
                  </p>
                ) : null}
                {saved.deliveryCode === "manual_review" ? (
                  <p className="mt-2 text-sm text-destructive">
                    Delivery needs manual review. Check provider records before sending again.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {["queued", "failed", "not_configured"].includes(saved.delivery) &&
                  saved.deliveryCode !== "manual_review" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || spam || !emailEnabled}
                      loading={retryReply.isPending && retryReply.variables?.id === saved.id}
                      onClick={() => retryReply.mutate(saved)}
                    >
                      Retry this email
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyMessage(saved.message)}
                  >
                    <Copy aria-hidden="true" /> Copy reply
                  </Button>
                  {!spam ? (
                    <Button asChild variant="ghost" size="sm">
                      <a
                        href={emailLink(saved.message)}
                        onClick={() =>
                          setNotice(
                            "Your email app can send this reply. Its delivery will not be marked Sent here.",
                          )
                        }
                      >
                        <Mail aria-hidden="true" /> Open email app
                      </a>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <form className="mt-6 border-t border-border pt-5" noValidate onSubmit={submitReply}>
        <h4 className="font-semibold">Reply to the customer</h4>
        <p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">
          Recipient: <span className="font-semibold">{request.email}</span>
        </p>
        {spam ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Move this case out of Spam before replying.
          </p>
        ) : null}
        <label htmlFor={replyId} className="mt-4 block text-sm font-semibold">
          Your reply
        </label>
        <Textarea
          ref={textarea}
          id={replyId}
          className="mt-2 min-h-40 bg-background leading-7"
          value={draft.message}
          maxLength={4000}
          disabled={busy || spam}
          required
          aria-invalid={Boolean(fieldError)}
          aria-describedby={`${replyId}-hint${fieldError ? ` ${replyId}-error` : ""}`}
          onChange={(event) => {
            const message = event.target.value;
            onDraftChange(request.id, {
              message,
              ...(message.trim() === draft.boundMessage
                ? { replyId: draft.replyId, boundMessage: draft.boundMessage }
                : {}),
            });
            if (fieldError) setFieldError("");
          }}
        />
        <p id={`${replyId}-hint`} className="mt-2 text-xs leading-5 text-muted-foreground">
          10–4,000 characters. Drafts stay in this panel while it is open. Keep payment credentials
          and unnecessary sensitive details out of replies.
        </p>
        {fieldError ? (
          <p id={`${replyId}-error`} role="alert" className="mt-2 text-sm text-destructive">
            {fieldError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={busy || spam || !draft.message.trim()}
            loading={reply.isPending}
          >
            {emailEnabled ? "Save and send reply" : "Save reply"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!draft.message.trim()}
            onClick={() => void copyMessage(draft.message, true)}
          >
            <Copy aria-hidden="true" /> Copy draft
          </Button>
          {draft.message.trim() && !spam ? (
            <Button asChild variant="secondary">
              <a
                href={emailLink(draft.message)}
                onClick={() =>
                  setNotice(
                    "Your email app can send this draft. It has not been sent or marked Sent by the site.",
                  )
                }
              >
                <Mail aria-hidden="true" /> Open email app
              </a>
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Copying or opening your email app does not record an email as sent. Sending a reply does
          not issue a payment refund or change the case status.
        </p>
      </form>
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        {notice ? <p className="text-sm leading-6">{notice}</p> : null}
      </div>
      {error ? (
        <p
          ref={errorRegion}
          tabIndex={-1}
          role="alert"
          className="mt-3 scroll-mt-28 text-sm leading-6 text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
