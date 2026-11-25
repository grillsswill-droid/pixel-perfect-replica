import { createPublicPageHead, seoFromMatches } from "@/lib/seo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { ItemCustomizer } from "@/components/site/item-customizer";
import { MenuCard } from "@/components/site/menu-card";
import { PageIntro } from "@/components/site/page-intro";
import { categoriesQuery, menuQuery } from "@/lib/catalog.functions";
import { CATEGORIES, type CategoryId, type MenuItem } from "@/lib/menu-types";
import { cn } from "@/lib/utils";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[];

export const Route = createFileRoute("/menu")({
  validateSearch: (s: Record<string, unknown>): { cat?: CategoryId } =>
    typeof s["cat"] === "string" && CATEGORY_IDS.includes(s["cat"])
      ? { cat: s["cat"] as CategoryId }
      : {},
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(menuQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]);
  },
  head: ({ matches }) => createPublicPageHead("/menu", seoFromMatches(matches)),
  component: MenuPage,
});

const FILTERS = ["Spicy", "Vegetarian", "Bestseller", "Signature", "Shareable"] as const;

function MenuPage() {
  const { data: menu } = useSuspenseQuery(menuQuery());
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const { cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/menu" });
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [tags, setTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return menu.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (
        tags.length &&
        !tags.every((t) => i.tags.some((x) => x.toLowerCase() === t.toLowerCase()))
      )
        return false;
      if (q && !`${i.name} ${i.description} ${i.ingredients.join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [menu, cat, tags, deferredQuery]);

  const categoryMap = new Map(
    CATEGORIES.map((category, index) => [category.id, { ...category, sort_order: index + 1 }]),
  );
  categories.forEach((category) => categoryMap.set(category.id, category));

  const displayCategories = [...categoryMap.values()].sort(
    (left, right) => left.sort_order - right.sort_order,
  );

  const groups = displayCategories
    .map((category) => ({
      ...category,
      items: filtered.filter((item) => item.category === category.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageIntro
        title="The menu"
        description="Browse the whole Grill & Swill line-up, search by ingredient, or jump straight to the kind of meal you want."
        compact
      />
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6">
      <div className="sticky top-[91px] z-20 -mx-4 rounded-b-2xl bg-background/95 px-4 py-4 shadow-[0_18px_30px_-28px_var(--charcoal)] backdrop-blur-md sm:-mx-6 sm:px-6">
        <div
          className="flex flex-wrap gap-2 pb-1"
          role="tablist"
          aria-label="Menu categories"
        >
          <CategoryTab active={!cat} onClick={() => navigate({ search: {} })} label="Everything" />
          {displayCategories.map((c) => (
            <CategoryTab
              key={c.id}
              active={cat === c.id}
              onClick={() => navigate({ search: { cat: c.id } })}
              label={c.short}
            />
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
              className="h-11 w-full rounded-xl border border-input bg-card pr-11 pl-10 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-charcoal"
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
                  "min-h-11 rounded-full border px-4 text-sm font-semibold transition active:scale-95",
                  on
                    ? "border-charcoal bg-charcoal text-cream"
                    : "border-input bg-card hover:border-charcoal",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm font-semibold text-muted-foreground" role="status" aria-live="polite">
          {filtered.length} item{filtered.length === 1 ? "" : "s"} match your filters
        </p>
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
            <motion.div
              layout
              className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {g.items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    // Menu content must be visible in the server HTML, even before hydration.
                    initial={false}
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
    </>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
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
      {active && (
        <motion.span
          layoutId="menu-tab"
          className="absolute inset-0 rounded-full bg-primary shadow-chunky"
        />
      )}
      <span className="relative">{label}</span>
    </button>
  );
}
