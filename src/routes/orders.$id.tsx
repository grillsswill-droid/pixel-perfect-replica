import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Check, ChefHat, CircleDot, PackageCheck, Truck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { getOrder } from "@/lib/orders.functions";
import { STATUS_FLOW, statusLabel } from "@/lib/order-status";
import { formatMoney } from "@/lib/pricing";
import type { Fulfillment, OrderLineSnapshot } from "@/lib/menu-types";

export const Route = createFileRoute("/orders/$id")({
  validateSearch: z.object({
    token: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
    payment: z.literal("successful").optional(),
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ params, deps }) =>
    deps.token ? getOrder({ data: { id: params.id, token: deps.token } }) : null,
  head: () => ({ meta: [
    { title: "Track your order | Grill & Swill" },
    { name: "description", content: "Follow your Grill & Swill order from grill to pickup or delivery." },
    { property: "og:title", content: "Track your order | Grill & Swill" },
    { property: "og:description", content: "Follow your Grill & Swill order from grill to pickup or delivery." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: OrderPage,
});

const STAGE_ICONS = [CircleDot, ChefHat, Truck, PackageCheck];

function OrderPage() {
  const order = Route.useLoaderData();
  const { id } = Route.useParams();
  const { token, payment } = Route.useSearch();
  const router = useRouter();
  const { clear: clearCart } = useCart();
  const handledPaymentReturn = useRef(false);

  useEffect(() => {
    if (payment !== "successful" || handledPaymentReturn.current) return;
    handledPaymentReturn.current = true;
    clearCart();
    window.sessionStorage.removeItem("grill-swill-checkout-request-v1");
    toast.success("Payment confirmed. Your order is in!");
    void router.navigate({
      to: "/orders/$id",
      params: { id },
      search: { token },
      replace: true,
    });
  }, [clearCart, id, payment, router, token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void router.invalidate();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  if (!order) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5">
        <div className="text-center">
          <h1 className="font-display text-4xl font-black uppercase">Order not found</h1>
          <p className="mt-2 text-muted-foreground">Check the tracking link and try again.</p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </main>
    );
  }

  const status = order.status;
  const paymentStatus = order.payment_status ?? "not_charged";
  const activeStage = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  const items = order.items as OrderLineSnapshot[];

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-12 text-cream sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">
            Your order is in good hands
          </p>
          <h1 className="font-display mt-3 text-4xl font-black uppercase sm:text-6xl">
            We’re on it.
          </h1>
          <p className="mt-3 text-cream/70">
            Order <span className="font-bold text-cream">#{order.order_number}</span> ·{" "}
            {statusLabel(status, order.fulfillment as Fulfillment)}
          </p>
          <p className="mt-2 text-sm text-cream/60">
            Receipt {order.receipt_number} · {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-4xl gap-6 px-5 py-10 sm:px-8 sm:py-14">
        {status === "cancelled" ? (
          <div className="rounded-3xl bg-card p-6 text-center shadow-card">
            <h2 className="font-display text-2xl font-black uppercase">This order was cancelled</h2>
          </div>
        ) : (
          <div className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
            <h2 className="font-display text-2xl font-black uppercase">Order progress</h2>
            <ol className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {STATUS_FLOW.map((stage, index) => {
                const Icon = STAGE_ICONS[index]!;
                const complete = index <= activeStage;
                return (
                  <li key={stage} className="relative">
                    {index > 0 && (
                      <span
                        className={`absolute top-5 right-1/2 hidden h-0.5 w-full sm:block ${complete ? "bg-primary" : "bg-border"}`}
                      />
                    )}
                    <span
                      className={`relative mx-auto grid h-11 w-11 place-items-center rounded-full transition-colors duration-300 ${complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {index === activeStage && (
                        <motion.span
                          layoutId="active-order-stage"
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full ring-4 ring-primary/25"
                          transition={{ type: "spring", stiffness: 320, damping: 32 }}
                        />
                      )}
                      {index < activeStage ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <p
                      className={`mt-3 text-center text-xs font-bold ${complete ? "text-charcoal" : "text-muted-foreground"}`}
                    >
                      {statusLabel(stage, order.fulfillment as Fulfillment)}
                    </p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-7 text-center text-xs text-muted-foreground">
              This tracker refreshes automatically as staff update your order.
            </p>
            {order.status_history?.length ? (
              <ol className="mt-5 space-y-2 border-t border-border pt-4">
                {order.status_history.map((entry, index) => (
                  <li
                    key={`${entry.status}-${entry.updated_at}-${index}`}
                    className="flex flex-wrap justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold">
                      {statusLabel(entry.status, order.fulfillment as Fulfillment)}
                    </span>
                    <time className="text-muted-foreground">
                      {new Date(entry.updated_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-black uppercase">In the bag</h2>
            <ul className="mt-4 divide-y divide-border">
              {items.map((item, index) => (
                <li
                  key={`${item.itemId}-${index}`}
                  className="flex justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    {item.quantity} × {item.name}
                    {item.bundleComponents?.length ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Includes:{" "}
                        {item.bundleComponents
                          .map((component) => `${component.quantity} × ${component.label}`)
                          .join(" · ")}
                      </span>
                    ) : null}
                    {item.summary.length > 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.summary.join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold">
                    {formatMoney(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-4 font-bold">
              <span>Total ({order.currency ?? "USD"})</span>
              <span>{formatMoney(order.total_cents)}</span>
            </div>
            <p className="mt-4 rounded-xl bg-accent p-3 text-xs leading-relaxed text-muted-foreground">
              {paymentStatus === "paid"
                ? `Payment verified${order.payment_method ? ` via ${order.payment_method}` : " via Flutterwave"}.`
                : paymentStatus === "pending" || paymentStatus === "processing"
                  ? "Payment confirmation is still pending. The kitchen will receive the order after verification."
                  : "No verified payment is attached to this order."}
            </p>
          </div>
          <aside className="rounded-3xl bg-accent p-6">
            <h2 className="font-display text-xl font-black uppercase">
              {order.fulfillment === "delivery" ? "Delivery details" : "Pickup details"}
            </h2>
            <p className="mt-3 text-sm font-bold">{order.customer_name}</p>
            {order.fulfillment === "delivery" && order.address && (
              <p className="mt-1 text-sm text-muted-foreground">
                {order.address.street}
                {order.address.unit ? `, ${order.address.unit}` : ""}
                <br />
                {order.address.city}, {order.address.state} {order.address.zip}
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Prepared at {order.stores?.name ?? "your selected Grill & Swill"}
            </p>
            {order.customer_phone ? (
              <p className="mt-1 text-xs text-muted-foreground">{order.customer_phone}</p>
            ) : null}
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/receipts/$id" params={{ id: order.id }} search={{ token }}>
                View receipt
              </Link>
            </Button>
            <Button asChild variant="hero" className="mt-6 w-full">
              <Link to="/menu">Order something else</Link>
            </Button>
          </aside>
        </div>
      </section>
    </main>
  );
}
