import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ItemCustomizer } from "@/components/site/item-customizer";
import { MenuCard } from "@/components/site/menu-card";
import { menuQuery } from "@/lib/catalog.functions";
import { CATEGORIES, type CategoryId, type MenuItem } from "@/lib/menu-types";
import { cn } from "@/lib/utils";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[];

export const Route = createFileRoute("/menu")({
  validateSearch: (s: Record<string, unknown>): { cat?: CategoryId } =>
    typeof s.cat === "string" && CATEGORY_IDS.includes(s.cat) ? { cat: s.cat as CategoryId } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(menuQuery()),
  head: () => ({
    meta: [
      { title: "Menu — Burgers, Chicken, Pizza & Coffee | Grill & Swill" },
      {
        name: "description",
        content: "Browse the full Grill & Swill menu: smash burgers, crispy chicken, wood-fired pizza, hand-cut fries and cold brew.",
      },
      { property: "og:title", content: "The Grill & Swill Menu" },
      { property: "og:description", content: "Smash burgers, crispy chicken, wood-fired pizza, hand-cut fries and cold brew." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});

const FILTERS = ["Spicy", "Vegetarian", "Bestseller", "Signature", "Shareable"] as const;

function MenuPage() {
  const { data: menu } = useSuspenseQuery(menuQuery());
  const { cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/menu" });
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (tags.length && !tags.every((t) => i.tags.some((x) => x.toLowerCase() === t.toLowerCase()))) return false;
      if (q && !`${i.name} ${i.description} ${i.ingredients.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [menu, cat, tags, query]);

  const groups = CATEGORIES.map((c) => ({ ...c, items: filtered.filter((i) => i.category === c.id) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-6">
      <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Order online</p>
      <h1 className="mt-2 text-5xl font-black uppercase sm:text-7xl">The Menu</h1>

      <div className="sticky top-[100px] z-20 -mx-4 mt-8 bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Menu categories">
          <CategoryTab active={!cat} onClick={() => navigate({ search: {} })} label="Everything" />
          {CATEGORIES.map((c) => (
            <CategoryTab key={c.id} active={cat === c.id} onClick={() => navigate({ search: { cat: c.id } })} label={c.short} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className="h-10 w-full rounded-full border-2 border-input bg-card pr-9 pl-10 text-sm outline-none focus:border-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-charcoal"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {FILTERS.map((f) => {
            const on = tags.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((t) => (on ? t.filter((x) => x !== f) : [...t, f]))}
                className={cn(
                  "h-10 rounded-full border-2 px-4 text-sm font-semibold transition active:scale-95",
                  on ? "border-charcoal bg-charcoal text-cream" : "border-input bg-card hover:border-charcoal",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-display text-2xl font-black uppercase">Nothing matches that</p>
          <p className="mt-2 text-muted-foreground">Try a different search or clear the filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTags([]);
              navigate({ search: {} });
            }}
            className="mt-4 text-sm font-bold text-primary hover:underline"
          >
            Clear everything
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="mt-12" aria-labelledby={`cat-${g.id}`}>
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-charcoal pb-3">
              <h2 id={`cat-${g.id}`} className="text-3xl font-black uppercase">
                {g.label}
              </h2>
              <p className="hidden text-sm text-muted-foreground sm:block">{g.blurb}</p>
            </div>
            <motion.div layout className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {g.items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <MenuCard item={item} onSelect={setSelected} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </section>
        ))
      )}

      <ItemCustomizer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CategoryTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-full px-5 py-2.5 font-display text-sm font-black uppercase transition",
        active ? "text-primary-foreground" : "text-charcoal/70 hover:text-charcoal",
      )}
    >
      {active && <motion.span layoutId="menu-tab" className="absolute inset-0 rounded-full bg-primary shadow-chunky" />}
      <span className="relative">{label}</span>
    </button>
  );
}
