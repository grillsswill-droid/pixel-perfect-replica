import { createPublicPageHead, seoFromMatches } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, Tag } from "lucide-react";
import { motion } from "motion/react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Stagger, StaggerItem } from "@/components/site/reveal";
import { PageIntro } from "@/components/site/page-intro";
import { Button } from "@/components/ui/button";
import { getCheckoutConfiguration } from "@/lib/admin.functions";
import { FREE_DELIVERY_THRESHOLD_CENTS, PROMOS, formatMoney } from "@/lib/pricing";

const dealsQuery = () =>
  queryOptions({
    queryKey: ["checkout-configuration"],
    queryFn: () => getCheckoutConfiguration(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/deals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dealsQuery()),
  head: ({ matches }) => createPublicPageHead("/deals", seoFromMatches(matches)),
  component: DealsPage,
});

function DealsPage() {
  const { data: config } = useQuery(dealsQuery());
  const promos = config?.promotions ?? PROMOS;
  const threshold = config?.freeDeliveryThresholdCents ?? FREE_DELIVERY_THRESHOLD_CENTS;

  return (
    <>
      <PageIntro
        title="Deals"
        description={`Copy a current promo code and paste it at checkout. Delivery is free over ${formatMoney(threshold)}.`}
        compact
      />
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
      <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
        {promos.map((p, i) => (
          <StaggerItem key={p.code}>
            <div
              className={
                i === 0
                  ? "h-full rounded-2xl bg-primary p-7 text-primary-foreground shadow-lift"
                  : "h-full rounded-2xl bg-card p-7 shadow-card"
              }
            >
              <Tag className="h-6 w-6" />
              <h2 className="mt-4 text-3xl font-black uppercase">{p.label}</h2>
              <p className="mt-2 opacity-80">{p.description}</p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.12 }}
                onClick={() => {
                  void navigator.clipboard?.writeText(p.code);
                  toast.success(`${p.code} copied — paste it at checkout`);
                }}
                className="mt-6 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-current px-5 py-3 font-display text-xl font-black tracking-widest"
              >
                {p.code} <Copy className="h-5 w-5" />
              </motion.button>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      <Button asChild variant="hero" size="xl" className="mt-10">
        <Link to="/menu">Start an order</Link>
      </Button>
      </div>
    </>
  );
}
