import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { getOrder } from "@/lib/orders.functions";
import { formatMoney } from "@/lib/pricing";
import type { OrderLineSnapshot } from "@/lib/menu-types";

export const Route = createFileRoute("/receipts/$id")({
  validateSearch: z.object({
    token: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
  }),
  loader: ({ params, search }) =>
    search.token ? getOrder({ data: { id: params.id, token: search.token } }) : null,
  head: () => ({
    meta: [
      { title: "Order receipt | Grill & Swill" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const order = Route.useLoaderData();
  const { token } = Route.useSearch();

  if (!order) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5">
        <div className="text-center">
          <h1 className="font-display text-3xl font-black uppercase">Receipt unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the receipt from order history on the device used to place the order.
          </p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/account/orders">View order history</Link>
          </Button>
        </div>
      </main>
    );
  }

  const items = order.items as OrderLineSnapshot[];
  const paymentStatus = order.payment_status ?? "not_charged";

  return (
    <main className="min-h-[65vh] bg-background px-4 py-8 sm:px-6 sm:py-12 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link to="/orders/$id" params={{ id: order.id }} search={{ token }}>
              Back to order
            </Link>
          </Button>
          <Button variant="hero" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
        </div>

        <article className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-dashed border-border pb-6">
            <div>
              <p className="font-display text-2xl font-black uppercase tracking-tight">
                Grill <span className="text-primary">&amp;</span> Swill
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {order.stores?.name ?? "Grill & Swill"}
              </p>
              {order.stores ? (
                <p className="text-sm text-muted-foreground">
                  {order.stores.address}, {order.stores.city}, {order.stores.state}
                  <br />
                  {order.stores.phone}
                </p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Receipt</p>
              <h1 className="mt-1 font-display text-2xl font-black">{order.receipt_number}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Order #{order.order_number}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
          </header>

          <section className="grid gap-4 border-b border-dashed border-border py-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                {order.fulfillment === "delivery" ? "Delivery to" : "Pickup for"}
              </h2>
              <p className="mt-2 font-semibold">{order.customer_name}</p>
              {order.customer_phone ? (
                <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
              ) : null}
              {order.fulfillment === "delivery" && order.address ? (
                <p className="text-sm text-muted-foreground">
                  {order.address.street}
                  {order.address.unit ? `, ${order.address.unit}` : ""}
                  <br />
                  {order.address.city}, {order.address.state} {order.address.zip}
                </p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Order status
              </h2>
              <p className="mt-2 font-semibold capitalize">{order.status}</p>
              <p className="text-sm text-muted-foreground">
                {order.fulfillment === "delivery" ? "Delivery" : "Pickup"}
              </p>
            </div>
          </section>

          <section className="py-6">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Items
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {items.map((item, index) => (
                <li
                  key={`${item.itemId}-${index}`}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold">
                      {item.quantity} × {item.name}
                    </span>
                    {item.bundleComponents?.length ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Includes:{" "}
                        {item.bundleComponents
                          .map((component) => `${component.quantity} × ${component.label}`)
                          .join(" · ")}
                      </span>
                    ) : null}
                    {item.summary.length ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.summary.join(" · ")}
                      </span>
                    ) : null}
                    {item.note ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Note: {item.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatMoney(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ml-auto max-w-sm border-t border-dashed border-border pt-5 text-sm">
            <p className="mb-2 text-right text-xs text-muted-foreground">
              Currency: {order.currency ?? "USD"}
            </p>
            <MoneyRow label="Subtotal" value={order.subtotal_cents} />
            {order.discount_cents > 0 ? (
              <MoneyRow
                label={order.promo_code ? `Discount (${order.promo_code})` : "Discount"}
                value={-order.discount_cents}
              />
            ) : null}
            {order.delivery_fee_cents > 0 ? (
              <MoneyRow label="Delivery" value={order.delivery_fee_cents} />
            ) : null}
            <MoneyRow label="Tax" value={order.tax_cents} />
            <MoneyRow label="Total" value={order.total_cents} strong />
          </section>

          <footer className="mt-6 border-t border-dashed border-border pt-5 text-sm">
            <p className="font-semibold">
              Payment status: {paymentStatus === "paid" ? "Paid" : "Not charged"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This checkout is a demo. No payment was processed or charged
              {order.payment_last4 ? `; card ending in ${order.payment_last4} was not charged` : ""}
              . This receipt records the order totals and is not proof of payment.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 py-1.5 ${strong ? "mt-2 border-t border-border pt-3 text-base font-black" : "text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );
}
