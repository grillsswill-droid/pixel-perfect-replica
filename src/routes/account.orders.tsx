import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ReceiptText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";
import { useGuestId } from "@/hooks/use-guest";
import { guestRewardsQuery } from "@/lib/order-queries";
import { formatMoney } from "@/lib/pricing";
import { statusLabel } from "@/lib/order-status";
import type { Fulfillment, OrderLineSnapshot } from "@/lib/menu-types";

export const Route = createFileRoute("/account/orders")({
  head: () => ({
    meta: [
      { title: "Your orders | Grill & Swill" },
      { name: "description", content: "Review and track your recent Grill & Swill orders." },
      { property: "og:title", content: "Your orders | Grill & Swill" },
      { property: "og:description", content: "Review and track your recent Grill & Swill orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomerOrdersPage,
});

function CustomerOrdersPage() {
  const guestId = useGuestId();
  const { data, isLoading, isError, isFetching, refetch } = useQuery(guestRewardsQuery(guestId));

  return (
    <div className="min-h-[65vh] bg-background">
      <PageIntro
        title="Your orders"
        description="Your order history and rewards are linked to this browser. Keep this device’s site data to reopen receipts and tracking later."
        tone="charcoal"
        compact
      />

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading your orders…</p> : null}
        {isError ? (
          <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            <p>We couldn’t load your order history.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              loading={isFetching}
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {!isLoading && !isError && (data?.orders.length ?? 0) === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card">
            <h2 className="font-display text-2xl font-black uppercase">No orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your next favorite is only a few taps away.
            </p>
            <Button asChild variant="hero" className="mt-5">
              <Link to="/menu">
                Browse the menu <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : null}

        <ul className="space-y-4">
          {(data?.orders ?? []).map((order) => {
            const items = order.items as unknown as OrderLineSnapshot[];
            const trackingSearch = { token: order.accessToken };
            return (
              <li key={order.id} className="rounded-3xl bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xl font-black uppercase">
                      Order #{order.order_number}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {statusLabel(order.status, order.fulfillment as Fulfillment)}
                    </p>
                  </div>
                  <p className="font-display text-xl font-black">
                    {formatMoney(order.total_cents)}
                  </p>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="hero">
                    <Link to="/orders/$id" params={{ id: order.id }} search={trackingSearch}>
                      Track order <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/receipts/$id" params={{ id: order.id }} search={trackingSearch}>
                      <ReceiptText className="h-4 w-4" />
                      Receipt {order.receipt_number ?? ""}
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
