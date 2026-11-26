import { Link } from "@tanstack/react-router";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCustomerSite } from "@/hooks/use-customer-site";
import { useStorefrontLocations } from "@/hooks/use-storefront-locations";
import { supportMailto } from "@/lib/customer-site";
import {
  SUPPORT_TOPICS,
  supportRequestSchema,
  type SupportRequestInput,
} from "@/lib/support-types";
import { CustomerContent, CustomerPageHeader } from "./customer-layout";

export const SUPPORT_TOPIC_LABELS: Record<(typeof SUPPORT_TOPICS)[number], string> = {
  order_issue: "A missing, incorrect or other order issue",
  payment: "Payment or checkout",
  cancellation_refund: "Cancellation or refund request",
  delivery_pickup: "Delivery or pickup",
  food_allergy: "Food or allergen question",
  rewards: "Rewards or order history",
  catering: "Catering",
  privacy: "Privacy or a data request",
  accessibility: "Accessibility",
  website: "A website problem",
  other: "Something else",
};

type Fields = Omit<SupportRequestInput, "requestId">;
const EMPTY: Fields = {
  name: "",
  email: "",
  topic: "order_issue",
  subject: "",
  message: "",
  orderReference: "",
};

export function SupportPage() {
  const { hasLocations } = useStorefrontLocations();
  const configuration = useCustomerSite();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLDivElement>(null);

  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setFailure(null);
    requestId.current = null;
  }
  function focusErrors() {
    requestAnimationFrame(() => errorSummary.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !configuration.inboxEnabled) return;
    requestId.current ??= crypto.randomUUID();
    const parsed = supportRequestSchema.safeParse({ ...fields, requestId: requestId.current });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setFailure(null);
      focusErrors();
      return;
    }
    setBusy(true);
    setErrors({});
    setFailure(null);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json().catch(() => null);
      if (
        !response.ok ||
        result?.ok !== true ||
        typeof result.reference !== "string" ||
        !/^GS-[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(result.reference)
      ) {
        const message =
          response.status === 429
            ? "You have sent several requests recently. Please wait before trying again, or email support."
            : "We could not confirm that your message was received. Your details are still here; try again or email support.";
        setFailure(message);
        focusErrors();
        return;
      }
      setReference(result.reference);
      requestAnimationFrame(() => success.current?.focus());
    } catch (error) {
      setFailure(
        error instanceof Error && error.name === "TimeoutError"
          ? "The request timed out. Your message is still here. Try again to confirm receipt, or email support."
          : "We could not connect to support. Your message is still here; try again or email our team.",
      );
      focusErrors();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CustomerPageHeader
        title="Let’s put it right."
        description="An order question, a payment problem or something that needs a closer look? Tell our support team what happened."
      />
      <CustomerContent>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)] lg:gap-16">
          <section aria-labelledby="support-form-title" className="min-w-0">
            <h2 id="support-form-title" className="font-display text-2xl font-black sm:text-3xl">
              Send a support request
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              We’ll use your email address to respond. An order reference helps us find the right
              record; a private tracking link or full card number is not needed.
            </p>
            {reference ? (
              <div
                ref={success}
                tabIndex={-1}
                role="status"
                className="mt-7 rounded-2xl bg-card p-6 outline-offset-4"
              >
                <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
                <h3 className="mt-4 font-display text-xl font-black">
                  Your message has been received
                </h3>
                <p className="mt-3 break-all text-sm leading-6">
                  Reference: <strong>{reference}</strong>
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Keep this reference if you need to follow up. Your request is in our support
                  inbox; this confirmation is not a refund approval or delivery promise.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReference(null);
                      setFields(EMPTY);
                      requestId.current = null;
                    }}
                  >
                    Send another message
                  </Button>
                  <Button asChild variant="hero">
                    <a href={supportMailto(configuration.supportEmail, `Follow-up ${reference}`)}>
                      Email a follow-up
                    </a>
                  </Button>
                </div>
              </div>
            ) : configuration.inboxEnabled ? (
              <form onSubmit={submit} noValidate className="mt-7 space-y-5">
                {Object.keys(errors).length || failure ? (
                  <div
                    ref={errorSummary}
                    role="alert"
                    tabIndex={-1}
                    className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 outline-offset-4"
                  >
                    <p className="font-bold">{failure ?? "Please check the details below."}</p>
                    {Object.entries(errors).length ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {Object.entries(errors).map(([key, error]) => (
                          <li key={key}>
                            <a
                              href={`#support-${key}`}
                              className="underline underline-offset-4"
                              onClick={(event) => {
                                event.preventDefault();
                                document.getElementById(`support-${key}`)?.focus();
                              }}
                            >
                              {error}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <fieldset disabled={busy} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SupportField name="name" label="Your name" error={errors.name}>
                      <input
                        id="support-name"
                        autoComplete="name"
                        required
                        maxLength={80}
                        value={fields.name}
                        onChange={(event) => change("name", event.target.value)}
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? "support-name-error" : undefined}
                        className="customer-input"
                      />
                    </SupportField>
                    <SupportField name="email" label="Email address" error={errors.email}>
                      <input
                        id="support-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={fields.email}
                        onChange={(event) => change("email", event.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "support-email-error" : undefined}
                        className="customer-input"
                      />
                    </SupportField>
                  </div>
                  <SupportField name="topic" label="What can we help with?" error={errors.topic}>
                    <select
                      id="support-topic"
                      value={fields.topic}
                      onChange={(event) => change("topic", event.target.value as Fields["topic"])}
                      className="customer-input"
                    >
                      {SUPPORT_TOPICS.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic === "delivery_pickup" && !hasLocations
                            ? "Delivery"
                            : SUPPORT_TOPIC_LABELS[topic]}
                        </option>
                      ))}
                    </select>
                  </SupportField>
                  <SupportField
                    name="orderReference"
                    label="Order or payment reference (optional)"
                    error={errors.orderReference}
                  >
                    <input
                      id="support-orderReference"
                      maxLength={80}
                      value={fields.orderReference ?? ""}
                      onChange={(event) => change("orderReference", event.target.value)}
                      aria-invalid={Boolean(errors.orderReference)}
                      aria-describedby={
                        errors.orderReference ? "support-orderReference-error" : undefined
                      }
                      className="customer-input"
                    />
                  </SupportField>
                  <SupportField name="subject" label="Subject" error={errors.subject}>
                    <input
                      id="support-subject"
                      required
                      maxLength={160}
                      value={fields.subject}
                      onChange={(event) => change("subject", event.target.value)}
                      aria-invalid={Boolean(errors.subject)}
                      aria-describedby={errors.subject ? "support-subject-error" : undefined}
                      className="customer-input"
                    />
                  </SupportField>
                  <SupportField name="message" label="Your message" error={errors.message}>
                    <textarea
                      id="support-message"
                      required
                      maxLength={4000}
                      rows={7}
                      value={fields.message}
                      onChange={(event) => change("message", event.target.value)}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={`support-message-hint${errors.message ? " support-message-error" : ""}`}
                      className="customer-input min-h-40 resize-y"
                    />
                    <p
                      id="support-message-hint"
                      className="mt-2 text-xs leading-5 text-muted-foreground"
                    >
                      {fields.message.length}/4,000 characters. Do not include passwords, full card
                      details or unnecessary medical information.
                    </p>
                  </SupportField>
                  <Button type="submit" variant="hero" loading={busy} className="w-full sm:w-auto">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {busy ? "Sending your request…" : "Send support request"}
                  </Button>
                </fieldset>
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                  Your details are used to review and respond to this request. Read our{" "}
                  <Link to="/privacy" className="font-semibold underline underline-offset-4">
                    privacy notice
                  </Link>
                  . Sending a request does not subscribe you to marketing.
                </p>
              </form>
            ) : (
              <div className="mt-7 rounded-2xl bg-card p-6">
                <p className="text-base font-bold">Please email our support team</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  The online form is temporarily unavailable. You can still send your question
                  directly by email.
                </p>
                <Button asChild variant="hero" className="mt-5">
                  <a href={supportMailto(configuration.supportEmail)}>
                    <Mail aria-hidden="true" /> Email support
                  </a>
                </Button>
              </div>
            )}
          </section>
          <aside className="h-fit space-y-8 border-t border-charcoal/15 pt-8 lg:border-t-0 lg:pt-0">
            <section aria-labelledby="support-email-title">
              <h2 id="support-email-title" className="font-display text-xl font-black">
                Email us directly
              </h2>
              <a
                href={supportMailto(configuration.supportEmail)}
                className="mt-3 inline-flex min-h-11 break-all text-base font-bold text-primary underline underline-offset-4"
              >
                {configuration.supportEmail}
              </a>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {configuration.supportHours ??
                  "You can send a request from anywhere. Reply times depend on the team’s availability and the details that need checking."}
              </p>
            </section>
            <section>
              <h2 className="font-display text-xl font-black">A little context helps</h2>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Your order reference and the store, if this concerns an order.</li>
                <li>What went wrong and what you would like us to review.</li>
                <li>The time and error message if a payment or website action failed.</li>
              </ul>
            </section>
            <section>
              <h2 className="font-display text-xl font-black">Food or allergy concerns</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Ask the store about ingredients before ordering. If you are experiencing a serious
                reaction or medical emergency, seek urgent local medical help rather than waiting
                for an email reply.
              </p>
              <Link
                to="/allergens"
                className="mt-3 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
              >
                Food and allergen information
              </Link>
            </section>
            <Link
              to="/faq"
              className="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
            >
              Check the FAQs
            </Link>
          </aside>
        </div>
      </CustomerContent>
    </>
  );
}

function SupportField({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`support-${name}`} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`support-${name}-error`} className="mt-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
