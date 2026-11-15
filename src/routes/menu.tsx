import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ItemCustomizer } from "@/components/site/item-customizer";
import { MenuCard } from "@/components/site/menu-card";
import { Stagger, StaggerItem } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { getMenu } from "@/lib/catalog.functions";
import { CATEGORIES, type CategoryId, type MenuItem } from "@/lib/menu-types";

export const Route = createFileRoute("/menu")({
  loader: () => getMenu(),
  head: () => ({
    meta: [
      { title: "Menu | Grill & Swill" },
      { name: "description", content: "Explore the Grill & Swill menu." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const items = Route.useLoaderData();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const visible = items.filter((item) => category === "all" || item.category === category);

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-14 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.2em] text-primary uppercase">
            Cooked to order, always
          </p>
          <h1 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-7xl">
            The menu
          </h1>
          <p className="mt-5 max-w-xl text-cream/70">
            Good ingredients take time. Luckily, we started before you got here.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="sticky top-[72px] z-20 -mx-5 mb-8 overflow-x-auto bg-background/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:overflow-visible sm:bg-transparent sm:p-0">
          <div
            className="flex w-max gap-2 sm:w-auto sm:flex-wrap"
            role="group"
            aria-label="Filter menu by category"
          >
            <Button
              variant={category === "all" ? "charcoal" : "outline"}
              onClick={() => setCategory("all")}
            >
              Everything
            </Button>
            {CATEGORIES.map((entry) => (
              <Button
                key={entry.id}
                variant={category === entry.id ? "charcoal" : "outline"}
                onClick={() => setCategory(entry.id)}
              >
                {entry.short}
              </Button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-16 text-center shadow-card">
            <p className="font-display text-2xl font-black uppercase">Nothing on the grill yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon for fresh additions.
            </p>
          </div>
        ) : (
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <StaggerItem key={item.id}>
                <MenuCard item={item} onSelect={setSelectedItem} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
      <ItemCustomizer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
}
