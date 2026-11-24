import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Clock3,
  Flame,
  MapPin,
  Sparkles,
  Truck,
} from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
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
import { useState } from "react";

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
  head: () => ({
    meta: [
      { title: "Grill & Swill | Fast food, made the slow way" },
      {
        name: "description",
        content:
          "Smash burgers, crispy chicken, wood-fired pizza and serious coffee. Order fresh from Grill & Swill.",
      },
      { property: "og:title", content: "Grill & Swill | Fast food, made the slow way" },
      {
        property: "og:description",
        content: "Fresh burger, chicken, pizza and coffee made for pickup or delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
      <QuickOrderCategoryShelves />
      <CategoryGrid />
      <Heritage />
      <RewardsTeaser />
    </>
  );
}

const QUICK_ORDER_TABS: { id: "popular" | QuickOrderGroup; label: string }[] = [
  { id: "popular", label: "Popular Combos" },
  { id: "burgers", label: "Burgers & Grill" },
  { id: "pizza", label: "Pizza Deals" },
  { id: "kids", label: "Kids' Meals" },
  { id: "desserts", label: "Ice Cream & Desserts" },
];

const QUICK_ORDER_GROUPS: { id: QuickOrderGroup; label: string; description: string }[] = [
  {
    id: "burgers",
    label: "Burgers & Grill",
    description: "Complete grill meals, bundled and ready to order.",
  },
  {
    id: "pizza",
    label: "Pizza Deals",
    description: "Choose an available pizza and make it a night in.",
  },
  {
    id: "kids",
    label: "Little Swillers",
    description: "Simple, satisfying meals for younger guests.",
  },
  {
    id: "desserts",
    label: "Ice Cream & Sweet Treats",
    description: "Leave room for a little something sweet.",
  },
];

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
  const [activeTab, setActiveTab] = useState<"popular" | QuickOrderGroup>("popular");
  const combos = orderedQuickOrderItems(menu ?? []);
  const popular = combos.filter((item) => item.is_featured && item.is_available).slice(0, 6);
  const visibleItems =
    activeTab === "popular"
      ? (popular.length ? popular : combos.filter((item) => item.is_available)).slice(0, 6)
      : combos.filter((item) => item.quick_order_group === activeTab);

  return (
    <>
      <section id="quick-order" className="quick-order-section bg-card px-5 py-16 text-charcoal sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                Quick order
              </p>
              <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">Your cravings. Sorted.</h2>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                Your favourites, bundled together. Pick your combo and order in seconds.
              </p>
            </div>
            <Link
              to="/menu"
              search={{ cat: "burgers" }}
              className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3"
            >
              Explore the menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            className="mb-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
            role="tablist"
            aria-label="Quick Order categories"
          >
            {QUICK_ORDER_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                role="tab"
                id={`quick-order-tab-${tab.id}`}
                aria-controls="quick-order-panel"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant="ghost"
                className={`quick-order-tab min-h-11 border px-4 py-2 text-sm font-bold sm:min-w-0 ${
                  activeTab === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-charcoal hover:border-primary"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div
            id="quick-order-panel"
            role="tabpanel"
            aria-labelledby={`quick-order-tab-${activeTab}`}
            tabIndex={0}
          >
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading meals">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-[2rem] border border-cream/10 bg-cream"
                  >
                    <div className="aspect-[1.35] animate-pulse bg-muted" />
                    <div className="space-y-3 p-5">
                      <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-3xl border border-cream/15 bg-cream/5 p-6 text-center">
                <p className="font-bold">The combo menu couldn’t load.</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 min-h-11 rounded-full border border-cream/40 px-5 text-sm font-bold hover:bg-cream/10"
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
              <div className="rounded-3xl border border-cream/15 bg-cream/5 p-6 text-center">
                <p className="font-bold">
                  {combos.length
                    ? "No meals in this category yet."
                    : "Signature combos are being prepared."}
                </p>
                <Link
                  to="/menu"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
                >
                  Browse the full menu <ArrowRight className="h-4 w-4" />
                </Link>
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
  return (
    <article className="quick-meal-card group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-charcoal transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Button
        variant="ghost"
        type="button"
        onClick={onSelect}
        className="relative block aspect-[1.5] h-auto w-full overflow-hidden rounded-none bg-muted p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
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
        <span className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-charcoal/90 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-cream uppercase">
            {item.is_featured ? "Featured pick" : "Quick Order"}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.14em] uppercase ${
              item.is_available ? "bg-success text-primary-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {item.is_available ? "Available" : "Sold out"}
          </span>
        </span>
      </Button>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight font-black uppercase">{item.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        {(item.bundle_components?.length ?? 0) > 0 ? (
          <div className="combo-inclusions mt-4 border-t border-border pt-3">
            <p className="text-xs font-black tracking-wide text-charcoal uppercase">
              Items included
            </p>
            <ul className="mt-2 space-y-1 text-sm text-charcoal/80">
              {item.bundle_components?.map((component, index) => (
                <li key={`${component.label}-${index}`}>
                  <span className="font-semibold">{component.quantity} ×</span> {component.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              {hasPricedOptions ? "Starting at" : "Combo price"}
            </p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums">
              {formatMoney(item.price_cents)}{" "}
              <span className="font-sans text-xs font-bold">USD</span>
            </p>
          </div>
          <Button
            type="button"
            variant="hero"
            size="sm"
            className="h-11 min-w-32"
            onClick={onOrder}
            disabled={!item.is_available || adding}
            loading={adding}
          >
            {!item.is_available ? "Sold out" : needsCustomization ? "Choose options" : "Quick add"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function QuickOrderCategoryShelves() {
  const { data: menu = [] } = useQuery(menuQuery());
  const { selected, setSelected, addingId, order } = useQuickOrderActions();
  const combos = orderedQuickOrderItems(menu);
  const popularIds = new Set(
    combos
      .filter((item) => item.is_featured && item.is_available)
      .slice(0, 6)
      .map((item) => item.id),
  );

  return (
    <>
      {QUICK_ORDER_GROUPS.map((group) => {
        const items = combos.filter(
          (item) => item.quick_order_group === group.id && !popularIds.has(item.id),
        );
        if (!items.length) return null;
        return (
          <section key={group.id} className="bg-cream px-5 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-7xl">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[0.18em] text-primary uppercase">
                    Quick Order
                  </p>
                  <h2 className="mt-2 text-3xl font-black uppercase sm:text-4xl">{group.label}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
                </div>
                <Link
                  to="/menu"
                  search={{
                    cat:
                      group.id === "kids" || group.id === "desserts"
                        ? group.id
                        : group.id === "burgers"
                          ? "burgers"
                          : "pizza",
                  }}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:gap-3"
                >
                  Browse {group.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="category-shelf-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <QuickOrderCard
                    key={item.id}
                    item={item}
                    adding={addingId === item.id}
                    onSelect={() => setSelected(item)}
                    onOrder={() => void order(item)}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <ItemCustomizer item={selected} onClose={() => setSelected(null)} />
    </>
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
          <div className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-cream uppercase">
            <span className="h-px w-8 bg-ember" /><Flame className="h-4 w-4 text-ember" /> Real food. No shortcuts.
          </div>

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
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-black tracking-[0.2em] text-primary uppercase">
              The good stuff
            </p>
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
                className="group relative block aspect-[0.83] overflow-hidden rounded-3xl bg-charcoal shadow-card"
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
          <p className="mb-3 text-xs font-black tracking-[0.2em] text-cream/65 uppercase">
            The long way is the right way
          </p>
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
          <div className="absolute -inset-4 rotate-3 rounded-[2rem] border-2 border-cream/30" />
          <img
            src={kitchenGrill}
            alt="Fresh ingredients cooking on the Grill & Swill flat top"
            width={1536}
            height={1024}
            className="relative aspect-[1.13] w-full rounded-[1.7rem] object-cover shadow-2xl"
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
              <p className="mb-3 flex items-center gap-2 text-xs font-black tracking-[0.2em] text-primary uppercase">
                <Sparkles className="h-4 w-4" /> The Swill Club
              </p>
              <h2 className="text-4xl leading-none font-black uppercase sm:text-5xl">
                Every bite brings you closer.
              </h2>
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
