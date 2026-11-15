import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgePercent, Pizza, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROMOS } from "@/lib/pricing";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals | Grill & Swill" },
      { name: "description", content: "A little something extra from the grill." },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-primary px-5 py-16 text-cream sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.2em] text-cream/70 uppercase">
            Good things come to hungry people
          </p>
          <h1 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-7xl">
            The tasty deals
          </h1>
          <p className="mt-5 max-w-xl text-cream/80">
            A few ways to make a great meal even better. Add a code at checkout.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-3">
        {PROMOS.map((promo, index) => {
          const Icon = index === 1 ? Pizza : index === 2 ? Sparkles : BadgePercent;
          return (
            <article
              key={promo.code}
              className="flex flex-col rounded-3xl bg-card p-6 shadow-card sm:p-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                <Icon />
              </span>
              <p className="mt-7 text-xs font-black tracking-[0.15em] text-primary uppercase">
                The Swill special
              </p>
              <h2 className="font-display mt-2 text-3xl leading-tight font-black uppercase">
                {promo.label}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {promo.description}
              </p>
              <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
                <span className="rounded-full bg-muted px-4 py-2 font-mono text-sm font-bold tracking-widest">
                  {promo.code}
                </span>
                <Button asChild variant="hero">
                  <Link to="/menu">
                    Order now <ArrowRight />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </section>
      <p className="mx-auto max-w-7xl px-5 pb-12 text-xs text-muted-foreground sm:px-8">
        Offer terms are checked automatically at checkout. Codes cannot be combined.
      </p>
    </main>
  );
}
