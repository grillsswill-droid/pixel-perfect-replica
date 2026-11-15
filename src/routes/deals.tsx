import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, Tag } from "lucide-react";
import { toast } from "sonner";

import { Stagger, StaggerItem } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { FREE_DELIVERY_THRESHOLD_CENTS, PROMOS, formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals & Promo Codes | Grill & Swill" },
      { name: "description", content: "Current Grill & Swill promo codes: $5 off $25, 20% off pizzas, and more. Apply them at checkout." },
      { property: "og:title", content: "Grill & Swill Deals" },
      { property: "og:description", content: "Promo codes for burgers, chicken and pizza. Apply at checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-6">
      <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Save on every bite</p>
      <h1 className="mt-2 text-5xl font-black uppercase sm:text-7xl">Deals</h1>
      <p className="mt-4 max-w-lg text-lg text-charcoal/75">
        Copy a code and paste it at checkout. Delivery is always free over {formatMoney(FREE_DELIVERY_THRESHOLD_CENTS)}.
      </p>
      <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
        {PROMOS.map((p, i) => (
          <StaggerItem key={p.code}>
            <div className={i === 0 ? "h-full rounded-3xl bg-flame p-7 text-primary-foreground shadow-lift" : "h-full rounded-3xl bg-card p-7 shadow-card"}>
              <Tag className="h-6 w-6" />
              <h2 className="mt-4 text-3xl font-black uppercase">{p.label}</h2>
              <p className="mt-2 opacity-80">{p.description}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(p.code);
                  toast.success(`${p.code} copied — paste it at checkout`);
                }}
                className="mt-6 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-current px-5 py-3 font-display text-xl font-black tracking-widest"
              >
                {p.code} <Copy className="h-5 w-5" />
              </button>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      <Button asChild variant="hero" size="xl" className="mt-10">
        <Link to="/menu">Start an order</Link>
      </Button>
    </div>
  );
}
