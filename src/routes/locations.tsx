import { createPublicPageHead, seoFromMatches } from "@/lib/seo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, createFileRoute, redirect } from "@tanstack/react-router";
import { Clock, MapPin, Phone } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";
import { useCart } from "@/hooks/use-cart";
import { storesQuery } from "@/lib/catalog.functions";
import { cn } from "@/lib/utils";
import { ExternalMap } from "@/components/customer/browser-controls";

export const Route = createFileRoute("/locations")({
  loader: async ({ context }) => {
    const stores = await context.queryClient.fetchQuery(storesQuery());
    if (!stores.length) throw redirect({ to: "/menu", replace: true });
    return stores;
  },
  staleTime: 0,
  head: ({ matches }) => createPublicPageHead("/locations", seoFromMatches(matches)),
  component: LocationsPage,
});

function LocationsPage() {
  const { data: stores } = useSuspenseQuery(storesQuery());
  const cart = useCart();
  const [activeId, setActiveId] = useState(stores[0]?.id ?? null);
  const active = stores.find((s) => s.id === activeId) ?? stores[0];
  const d = 0.012;
  const mapSrc = active
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${active.lng - d},${active.lat - d},${active.lng + d},${active.lat + d}&layer=mapnik&marker=${active.lat},${active.lng}`
    : null;

  if (!stores.length) return <Navigate to="/menu" replace />;

  return (
    <>
      <PageIntro
        title="Locations"
        description="Compare store details, check current hours, and choose exactly where you want to collect your order."
        compact
      />
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
        <div className="mt-10 grid gap-6 lg:grid-cols-[420px_1fr]">
          <ul className="space-y-3">
            {stores.map((s) => (
              <li key={s.id}>
                <motion.button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  aria-pressed={active?.id === s.id}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.12 }}
                  className={cn(
                    "relative w-full rounded-2xl border bg-card p-5 text-left transition",
                    active?.id === s.id
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {active?.id === s.id && (
                    <motion.span
                      layoutId="active-location"
                      aria-hidden="true"
                      className="absolute top-6 right-5 h-2.5 w-2.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    />
                  )}
                  <h2 className="pr-5 text-xl font-black uppercase">{s.name}</h2>
                  <p className="mt-2 flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {s.address}, {s.city}, {s.state} {s.zip}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    {s.hours}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-primary" />
                    {s.phone}
                  </p>
                  {s.features.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-4">
            {mapSrc && (
              <ExternalMap
                title={`Map of ${active?.name}`}
                src={mapSrc}
                className="h-[420px] w-full rounded-2xl border-0 shadow-card sm:h-[480px]"
              />
            )}
            {active && (
              <Button
                asChild
                variant="hero"
                size="xl"
                onClick={() => {
                  cart.setStoreId(active.id);
                  cart.setFulfillment("pickup");
                }}
              >
                <Link to="/menu">Order pickup from {active.name}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
