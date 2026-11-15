import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3, MapPin, Phone, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { getStores } from "@/lib/catalog.functions";

export const Route = createFileRoute("/locations")({
  loader: () => getStores(),
  head: () => ({
    meta: [
      { title: "Locations | Grill & Swill" },
      { name: "description", content: "Find your neighborhood Grill & Swill." },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  const stores = Route.useLoaderData();
  const cart = useCart();
  const navigate = useNavigate();
  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-14 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.2em] text-primary uppercase">
            Your neighborhood, our grill
          </p>
          <h1 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-7xl">
            Come on over.
          </h1>
          <p className="mt-5 max-w-xl text-cream/70">
            Find the closest Grill & Swill and come hungry.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {stores.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-16 text-center shadow-card">
            <Store className="mx-auto h-8 w-8 text-primary" />
            <h2 className="font-display mt-4 text-2xl font-black uppercase">
              We’re firing up new locations
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No stores are listed right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => {
              const address = `${store.address}, ${store.city}, ${store.state} ${store.zip}`;
              return (
                <article key={store.id} className="rounded-3xl bg-card p-6 shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-widest text-primary uppercase">
                        Grill & Swill
                      </p>
                      <h2 className="font-display mt-2 text-2xl font-black uppercase">
                        {store.name}
                      </h2>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
                      <Store />
                    </span>
                  </div>
                  <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                    <p className="flex gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      {address}
                    </p>
                    <p className="flex gap-2">
                      <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                      {store.hours}
                    </p>
                    <a className="flex gap-2 hover:text-primary" href={`tel:${store.phone}`}>
                      <Phone className="h-4 w-4 shrink-0 text-primary" />
                      {store.phone}
                    </a>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {store.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="mt-7 flex gap-3">
                    <Button
                      variant="hero"
                      className="flex-1"
                      onClick={() => {
                        cart.setStoreId(store.id);
                        void navigate({ to: "/menu" });
                      }}
                    >
                      Order here
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Directions
                      </a>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
