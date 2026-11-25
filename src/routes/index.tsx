import { createPublicPageHead, seoFromMatches } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Flame,
  MapPin,
  Search,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import heroFeast from "@/assets/hero-feast.jpg";
import kitchenGrill from "@/assets/kitchen-grill.jpg";
import { Reveal } from "@/components/site/reveal";
import { ItemCustomizer } from "@/components/site/item-customizer";
import { Button } from "@/components/ui/button";
import { CATEGORY_IMAGES, foodImage } from "@/lib/food-images";
import { categoriesQuery, menuQuery } from "@/lib/catalog.functions";
import { useCart } from "@/hooks/use-cart";
import { CATEGORIES, type MenuItem, type QuickOrderGroup } from "@/lib/menu-types";
import { defaultSelections, formatMoney } from "@/lib/pricing";
import { verifyQuickOrderSelection } from "@/lib/catalog.functions";

const rewardTiers = [
  { points: 250, label: "Free fries or lemonade", value: "$2.50 off" },
  { points: 500, label: "Any coffee or shake", value: "$5 off" },
  { points: 900, label: "Any burger or sandwich", value: "$9 off" },
  { points: 1500, label: 'Any 16" pizza', value: "$15 off" },
];

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(menuQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]);
  },
  head: ({ matches }) => createPublicPageHead("/", seoFromMatches(matches)),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <Hero />
      <div className="flavor-strip" aria-hidden="true">
        <span>Smash. Sip. Repeat.</span><Flame /><span>Big flavour. Zero shortcuts.</span><Flame /><span>Grill & Swill</span><Flame />
      </div>
      <QuickOrderMeals />
      <CategoryGrid />
      <Heritage />
      <RewardsTeaser />
    </>
  );
}

type QuickOrderFilter = "all" | "popular" | QuickOrderGroup;
type QuickOrderSort = "recommended" | "price-low" | "price-high" | "name";

const QUICK_ORDER_FILTERS: { id: QuickOrderFilter; label: string }[] = [
  { id: "all", label: "All meals" },
  { id: "popular", label: "Popular" },
  { id: "burgers", label: "Burgers & Grill" },
  { id: "pizza", label: "Pizza Deals" },
  { id: "kids", label: "Little Swillers" },
  { id: "desserts", label: "Sweet Treats" },
];

const QUICK_ORDER_GROUP_LABELS: Record<QuickOrderGroup, string> = {
  burgers: "Burgers & Grill",
  pizza: "Pizza Deals",
  kids: "Little Swillers",
  desserts: "Sweet Treats",
};

function orderedQuickOrderItems(menu: MenuItem[]) {
  return menu
    .filter((item) => item.is_quick_order && item.quick_order_group)
    .sort(
      (left, right) =>
        (left.quick_order_order ?? left.sort_order) - (right.quick_order_order ?? right.sort_order),
    );
}

function useQuickOrderActions() {
  const cart = useCart();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function order(item: MenuItem) {
    if (!item.is_available || addingId) return;
    if (item.options.some((group) => group.required)) {
      setSelected(item);
      return;
    }

    const selections = defaultSelections(item);
    setAddingId(item.id);
    try {
      const verification = await verifyQuickOrderSelection({
        data: { itemId: item.id, selections },
      });
      if (!verification.ok) {
        toast.error(verification.error);
        return;
      }
      cart.addLine({
        ...verification.line,
        quantity: 1,
        selections,
        removed: [],
        note: "",
      });
      toast.success(`${item.name} added to your bag`, {
        description: "Your combo is ready for checkout.",
        action: { label: "View bag", onClick: () => cart.setOpen(true) },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The combo couldn't be added. Try again.",
      );
    } finally {
      setAddingId(null);
    }
  }

  return { cart, selected, setSelected, addingId, order };
}

function QuickOrderMeals() {
  const { data: menu, isError, isLoading, refetch } = useQuery(menuQuery());
  const { selected, setSelected, addingId, order } = useQuickOrderActions();
  const [activeFilter, setActiveFilter] = useState<QuickOrderFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<QuickOrderSort>("recommended");
  const deferredQuery = useDeferredValue(query);
  const combos = useMemo(() => orderedQuickOrderItems(menu ?? []), [menu]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const next = combos.filter((item) => {
      if (activeFilter === "popular" && !item.is_featured) return false;
      if (
        activeFilter !== "all" &&
        activeFilter !== "popular" &&
        item.quick_order_group !== activeFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const searchable = [
        item.name,
        item.description,
        item.tags.join(" "),
        item.bundle_components?.map((component) => component.label).join(" ") ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });

    if (sort === "price-low") return next.sort((left, right) => left.price_cents - right.price_cents);
    if (sort === "price-high") return next.sort((left, right) => right.price_cents - left.price_cents);
    if (sort === "name") return next.sort((left, right) => left.name.localeCompare(right.name));
    return next.sort((left, right) => {
      if (left.is_available !== right.is_available) return left.is_available ? -1 : 1;
      if (left.is_featured !== right.is_featured) return left.is_featured ? -1 : 1;
      return (
        (left.quick_order_order ?? left.sort_order) -
        (right.quick_order_order ?? right.sort_order)
      );
    });
  }, [activeFilter, combos, deferredQuery, sort]);

  return (
    <>
      <section id="quick-order" className="quick-order-section bg-cream px-5 py-16 text-charcoal sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-6" data-reveal="heading">
            <div className="max-w-2xl">
              <h2 className="text-4xl leading-[0.95] font-black uppercase sm:text-6xl">
                Quick order. Everything in one place.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Search every combo, filter by craving, and sort the full Quick Order menu without
                jumping between separate sections.
              </p>
            </div>
            <Link
              to="/menu"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary transition-[gap] hover:gap-3"
            >
              Browse the full menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="quick-order-controls mb-7 rounded-2xl bg-card p-4 sm:p-5" data-reveal="rise">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-charcoal/70">
                Find a meal
                <span className="relative block">
                  <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search burgers, pizza, kids' meals…"
                    className="h-12 w-full rounded-xl border border-input bg-background pr-12 pl-11 text-base font-medium normal-case tracking-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-charcoal"
                      aria-label="Clear Quick Order search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </span>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-charcoal/70">
                Sort by
                <span className="relative block">
                  <ArrowUpDown className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as QuickOrderSort)}
                    className="h-12 w-full appearance-none rounded-xl border border-input bg-background pr-10 pl-11 text-base font-semibold normal-case tracking-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="name">Name: A to Z</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter Quick Order meals">
              {QUICK_ORDER_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={activeFilter === filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`quick-order-filter min-h-11 border px-4 py-2 text-sm font-bold transition-colors ${
                    activeFilter === filter.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-charcoal hover:border-primary hover:text-primary"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div id="quick-order-results" aria-busy={isLoading}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
                {isLoading
                  ? "Loading Quick Order meals…"
                  : `${visibleItems.length} meal${visibleItems.length === 1 ? "" : "s"} ready to browse`}
              </p>
              {(query || activeFilter !== "all" || sort !== "recommended") ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("all");
                    setSort("recommended");
                  }}
                  className="min-h-11 text-sm font-bold text-primary underline decoration-primary/35 decoration-2 hover:decoration-primary"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading meals">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="grid min-h-40 grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl bg-card sm:flex sm:flex-col"
                  >
                    <div className="animate-pulse bg-muted sm:aspect-[1.45]" />
                    <div className="flex-1 space-y-3 p-4">
                      <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
                <p className="font-bold">The combo menu couldn’t load.</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 min-h-11 rounded-full border border-charcoal/25 px-5 text-sm font-bold transition hover:border-primary hover:text-primary"
                >
                  Try again
                </button>
              </div>
            ) : visibleItems.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <QuickOrderCard
                    key={item.id}
                    item={item}
                    adding={addingId === item.id}
                    onSelect={() => setSelected(item)}
                    onOrder={() => void order(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-card p-8 text-center shadow-card">
                <p className="font-display text-2xl font-black uppercase">
                  {combos.length ? "No meals match those filters" : "Signature combos are being prepared"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("all");
                    setSort("recommended");
                  }}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
                >
                  Show every Quick Order meal <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      <ItemCustomizer item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function QuickOrderCard({
  item,
  adding,
  onSelect,
  onOrder,
}: {
  item: MenuItem;
  adding: boolean;
  onSelect: () => void;
  onOrder: () => void;
}) {
  const imageSrc = foodImage(item.image_key, item.slug);
  const needsCustomization = item.options.some((group) => group.required);
  const hasPricedOptions = item.options.some((group) =>
    group.choices.some((choice) => choice.price_cents > 0),
  );
  const groupLabel = item.quick_order_group
    ? QUICK_ORDER_GROUP_LABELS[item.quick_order_group]
    : "Quick Order";
  const inclusionSummary = item.bundle_components
    ?.slice(0, 3)
    .map((component) => `${component.quantity}× ${component.label}`)
    .join(" · ");
  return (
    <motion.article
      layout
      transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
      className="quick-meal-card group grid min-h-40 grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl bg-card text-charcoal transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:flex sm:h-full sm:flex-col"
    >
      <Button
        variant="ghost"
        type="button"
        onClick={onSelect}
        className="relative block h-full min-h-40 w-full overflow-hidden rounded-none bg-muted p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary sm:aspect-[1.45] sm:h-auto sm:min-h-0"
        aria-label={`View ${item.name} details`}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
        <span className="absolute inset-x-2 top-2 flex flex-wrap items-center justify-between gap-1.5 sm:inset-x-3 sm:top-3">
          <span className="rounded-full bg-charcoal/92 px-2.5 py-1 text-[9px] font-black tracking-[0.12em] text-cream uppercase sm:px-3 sm:py-1.5 sm:text-[10px]">
            {item.is_featured ? "Featured" : groupLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-[0.12em] uppercase sm:px-3 sm:py-1.5 sm:text-[10px] ${
              item.is_available ? "bg-success text-charcoal" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {item.is_available ? "Available" : "Sold out"}
          </span>
        </span>
      </Button>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display line-clamp-2 leading-[1.02] font-black uppercase">{item.name}</h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {item.description}
        </p>
        {inclusionSummary ? (
          <p className="mt-3 line-clamp-1 border-t border-border pt-3 text-[11px] font-semibold text-charcoal/70 sm:text-xs">
            Includes {inclusionSummary}
            {(item.bundle_components?.length ?? 0) > 3 ? " + more" : ""}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4 sm:gap-4 sm:pt-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-primary sm:text-[10px]">
              {hasPricedOptions ? "Starting at" : "Combo price"}
            </p>
            <p className="mt-1 font-display text-xl font-black tabular-nums sm:text-2xl">
              {formatMoney(item.price_cents)}{" "}
              <span className="hidden font-sans text-[10px] font-bold sm:inline">USD</span>
            </p>
          </div>
          <Button
            type="button"
            variant="hero"
            size="sm"
            className="h-11 min-w-16 px-3 sm:min-w-28 sm:px-4"
            onClick={onOrder}
            disabled={!item.is_available || adding}
            loading={adding}
            aria-label={`${!item.is_available ? "Sold out" : needsCustomization ? "Choose options for" : "Quick add"} ${item.name}`}
          >
            <span className="sm:hidden">
              {!item.is_available ? "Sold" : needsCustomization ? "Choose" : "Add"}
            </span>
            <span className="hidden sm:inline">
              {!item.is_available ? "Sold out" : needsCustomization ? "Choose options" : "Quick add"}
            </span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const prefersReducedMotion = useReducedMotion();
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", prefersReducedMotion ? "0%" : "16%"]);

  return (
    <section
      ref={heroRef}
      className="storefront-hero relative isolate overflow-hidden bg-charcoal text-cream"
    >
      <motion.div style={{ y: imageY }} className="absolute inset-0 -z-20 h-[116%]">
        <img
          src={heroFeast}
          alt="Grill & Swill smash burgers, pizza and drinks in our signature branded packaging"
          className="hero-food h-full w-full object-cover object-center"
          fetchPriority="high"
        />
      </motion.div>
      <div className="hero-shade absolute inset-0 -z-10" />

      <div className="hero-inner mx-auto flex max-w-7xl items-center px-5 sm:px-8">
        <div className="hero-copy max-w-2xl">
          <h1 className="hero-title font-black uppercase">
            Grill <span className="text-ember">&</span><br />Swill<span className="text-ember">.</span>
          </h1>

          <p className="mt-5 font-display text-xl font-bold uppercase text-cream sm:text-2xl">Big bites. Good times.</p>

          <p className="mt-4 max-w-md text-base leading-relaxed text-cream/80">
            Smash burgers, hand-breaded chicken, 48-hour pizza dough. Made fresh, served fast, and
            worth getting your hands messy for.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild variant="hero" size="xl">
              <Link to="/menu">
                Start your order <ArrowRight />
              </Link>
            </Button>
            <Link
              to="/locations"
              className="inline-flex items-center gap-2 px-2 py-3 text-sm font-bold text-cream transition hover:text-primary"
            >
              <MapPin className="h-4 w-4" /> Find your nearest grill
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-cream/65">
            <span className="flex -space-x-2">
              {[
                { label: "Burger", icon: Flame },
                { label: "Pizza", icon: Sparkles },
                { label: "Chicken", icon: BadgeCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    aria-label={item.label}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-charcoal bg-cream text-charcoal"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })}
            </span>
            <span>Good things are happening on the grill</span>
          </div>
        </div>
      </div>

      <a
        href="#quick-order"
        className="absolute right-8 bottom-8 hidden items-center gap-2 text-xs font-bold tracking-widest text-cream/70 uppercase transition hover:text-cream sm:flex"
      >
        Scroll for the good stuff <ArrowDown className="h-4 w-4 motion-safe:animate-bounce" />
      </a>
    </section>
  );
}

function CategoryGrid() {
  const { data: categories = CATEGORIES } = useQuery(categoriesQuery());
  return (
    <section id="menu-favorites" className="bg-cream px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal variant="heading" className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="text-4xl leading-none font-black uppercase sm:text-6xl">
              What sounds good?
            </h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3"
          >
            See the whole menu <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
          {categories.map((category, index) => (
            <Reveal key={category.id} delay={index * 0.06}>
              <Link
                to="/menu"
                search={{ cat: category.id }}
                className="group relative block aspect-[0.83] overflow-hidden rounded-2xl bg-charcoal shadow-card"
              >
                {CATEGORY_IMAGES[category.id] ? (
                  <img
                    src={CATEGORY_IMAGES[category.id]}
                    alt={category.label}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-110 group-hover:opacity-70"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-cream sm:p-5">
                  <p className="text-xl leading-none font-black uppercase sm:text-2xl">
                    {category.short}
                  </p>
                  <p className="mt-2 text-xs text-cream/75">{category.blurb}</p>
                  <span className="mt-4 grid h-8 w-8 place-items-center rounded-full bg-primary text-cream transition group-hover:translate-x-1">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Heritage() {
  return (
    <section className="overflow-hidden bg-primary text-cream">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_0.9fr] md:py-24">
        <Reveal>
          <h2 className="max-w-xl text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
            Fast food.
            <br />
            Slow-made.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/80">
            We grind our beef every morning, hand-cut potatoes before the doors open, and give our
            dough the time it deserves. You can taste the difference.
          </p>
          <Button asChild variant="cream" size="lg" className="mt-8">
            <Link to="/menu">
              Taste the difference <ArrowRight />
            </Link>
          </Button>
        </Reveal>

        <Reveal delay={0.12} className="relative">
          <div className="absolute -inset-4 rotate-3 rounded-2xl border border-cream/30" />
          <img
            src={kitchenGrill}
            alt="Fresh ingredients cooking on the Grill & Swill flat top"
            width={1536}
            height={1024}
            className="relative aspect-[1.13] w-full rounded-2xl object-cover shadow-2xl"
          />
          <span className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm font-black text-charcoal shadow-lg">
            <BadgeCheck className="h-5 w-5 text-primary" /> Made fresh, every day
          </span>
        </Reveal>
      </div>
    </section>
  );
}

function RewardsTeaser() {
  return (
    <section className="bg-cream px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="border-y border-charcoal/20 py-8 text-charcoal sm:py-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <h2 className="text-4xl leading-none font-black uppercase sm:text-5xl">
                  Every bite brings you closer.
                </h2>
              </div>
              <p className="mt-4 text-muted-foreground">
                Earn 10 points for every dollar. Get a little something on us when you come back
                hungry.
              </p>
            </div>
            <Button asChild variant="hero" size="xl">
              <Link to="/rewards">
                Get the perks <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {rewardTiers.map((tier) => (
              <div
                key={tier.points}
                className="border-l-2 border-primary p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-[0.2em] text-primary uppercase">
                    {tier.points} pts
                  </p>
                  <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cream">
                    Reward
                  </span>
                </div>
                <p className="mt-4 text-base font-black text-charcoal">{tier.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tier.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Reveal className="border-t border-charcoal/20 py-5">
            <Clock3 className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Fast pickup</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Warm, ready-to-go bags in about 15 minutes, even on the busiest lunch rush.
            </p>
          </Reveal>

          <Reveal
            delay={0.07}
            className="border-t border-charcoal/20 py-5"
          >
            <Truck className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Fresh delivery</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Local drops from your nearest grill. Check checkout for current delivery thresholds.
            </p>
          </Reveal>

          <Reveal
            delay={0.14}
            className="border-t border-charcoal/20 py-5"
          >
            <BadgeCheck className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Always consistent</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Fresh ingredients, time-tested recipes, and a kitchen built for speed.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
