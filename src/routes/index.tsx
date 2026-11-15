import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, BadgeCheck, Flame, MapPin, Sparkles } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import heroFeast from "@/assets/hero-feast.jpg";
import kitchenGrill from "@/assets/kitchen-grill.jpg";
import { Button } from "@/components/ui/button";
import { CATEGORY_IMAGES } from "@/lib/food-images";
import { CATEGORIES } from "@/lib/menu-types";
import { Reveal } from "@/components/site/reveal";

import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Bike, Clock, Flame, MapPin, Store as StoreIcon } from "lucide-react";
import { useRef, useState } from "react";

import heroFeast from "@/assets/hero-feast.jpg";
import kitchenGrill from "@/assets/kitchen-grill.jpg";
import { ItemCustomizer } from "@/components/site/item-customizer";
import { MenuCard } from "@/components/site/menu-card";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { menuQuery } from "@/lib/catalog.functions";
import { CATEGORY_IMAGES } from "@/lib/food-images";
import { CATEGORIES, type MenuItem } from "@/lib/menu-types";
import { POINTS_PER_DOLLAR, REWARD_TIERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grill & Swill | Fast food, made the slow way" },
      {
        name: "description",
        content:
          "Smash burgers, crispy chicken, wood-fired pizza and serious coffee. Order fresh from Grill & Swill.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);

  head: () => ({
    meta: [
      { title: "Grill & Swill — Smash Burgers, Crispy Chicken & Pizza" },
      {
        name: "description",
        content: "Order smash burgers, buttermilk fried chicken, wood-fired pizza and 18-hour cold brew for delivery or pickup.",
      },
      { property: "og:title", content: "Grill & Swill — Fast food, made the slow way" },
      { property: "og:description", content: "Smash burgers, crispy chicken, wood-fired pizza and cold brew. Delivery or pickup." },
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
      <CategoryGrid />
      <Featured />
      <Heritage />
      <RewardsTeaser />
    </>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main>
      <section
        ref={heroRef}
        className="relative isolate min-h-[650px] overflow-hidden bg-charcoal text-cream sm:min-h-[720px]"
      >
        <motion.div style={{ y: imageY }} className="absolute inset-0 -z-20 h-[116%]">
          <img
            src={heroFeast}
            alt=""
            className="h-full w-full object-cover object-center opacity-55"
            fetchPriority="high"
          />
        </motion.div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal via-charcoal/80 to-charcoal/15" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/70 via-transparent to-charcoal/10" />
        <div className="mx-auto flex min-h-[650px] max-w-7xl items-center px-5 py-20 sm:min-h-[720px] sm:px-8">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-cream/30 bg-charcoal/35 px-4 py-2 text-xs font-bold tracking-[0.17em] text-cream uppercase backdrop-blur"
            >
              <Flame className="h-4 w-4 text-primary" /> Real food. No shortcuts.
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="font-display max-w-3xl text-6xl leading-[0.9] font-black tracking-[-0.06em] uppercase sm:text-8xl lg:text-[108px]"
            >
              Good food.
              <br />
              <span className="text-primary">No funny</span>
              <br />
              business.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-7 max-w-lg text-base leading-relaxed text-cream/80 sm:text-lg"
            >
              Smash burgers, hand-breaded chicken, 48-hour pizza dough. Made fresh, served fast, and
              worth getting your hands messy for.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
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
            </motion.div>
            <div className="mt-12 flex items-center gap-3 text-xs font-semibold tracking-wide text-cream/65">
              <span className="flex -space-x-2">
                {["🍔", "🍕", "🍗"].map((item) => (
                  <span
                    key={item}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-charcoal bg-cream text-base"
                  >
                    {item}
                  </span>
                ))}
              </span>
              <span>Good things are happening on the grill</span>
            </div>
          </div>
        </div>
        <a
          href="#menu-favorites"
          className="absolute right-8 bottom-8 hidden items-center gap-2 text-xs font-bold tracking-widest text-cream/70 uppercase transition hover:text-cream sm:flex"
        >
          Scroll for the good stuff <ArrowDown className="h-4 w-4 animate-bounce" />
        </a>
      </section>

      <section className="bg-cream px-5 py-20 sm:px-8 sm:py-28" id="menu-favorites">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 text-xs font-black tracking-[0.2em] text-primary uppercase">
                The good stuff
              </p>
              <h2 className="font-display text-4xl leading-none font-black uppercase sm:text-6xl">
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
            {CATEGORIES.map((category, index) => (
              <Reveal key={category.id} delay={index * 0.06}>
                <Link
                  to="/menu"
                  className="group relative block aspect-[0.83] overflow-hidden rounded-3xl bg-charcoal shadow-card"
                >
                  <img
                    src={CATEGORY_IMAGES[category.id]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-110 group-hover:opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-cream sm:p-5">
                    <p className="font-display text-xl leading-none font-black uppercase sm:text-2xl">
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

      <section className="overflow-hidden bg-primary text-cream">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_0.9fr] md:py-24">
          <Reveal>
            <p className="mb-3 text-xs font-black tracking-[0.2em] text-cream/65 uppercase">
              The long way is the right way
            </p>
            <h2 className="font-display max-w-xl text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
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
              loading="lazy"
              className="relative aspect-[1.13] w-full rounded-[1.7rem] object-cover shadow-2xl"
            />
            <span className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3 text-sm font-black text-charcoal shadow-lg">
              <BadgeCheck className="h-5 w-5 text-primary" /> Made fresh, every day
            </span>
          </Reveal>
        </div>
      </section>

      <section className="bg-charcoal px-5 py-16 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] border border-cream/10 bg-white/[0.04] p-7 sm:p-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-black tracking-[0.2em] text-primary uppercase">
              <Sparkles className="h-4 w-4" /> The Swill Club
            </p>
            <h2 className="font-display text-4xl leading-none font-black uppercase sm:text-5xl">
              Every bite brings you closer.
            </h2>
            <p className="mt-4 text-cream/70">
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
      </section>
    </main>
    <section ref={ref} className="relative isolate min-h-[88vh] overflow-hidden bg-charcoal text-cream">
      <motion.img
        src={heroFeast}
        alt="A Grill & Swill smash burger in a branded wrapper, crispy chicken sandwich, pepperoni pizza slice and a branded cold brew cup"
        width={1920}
        height={1088}
        style={{ y, scale }}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-smoke" />
      <motion.div style={{ y: textY, opacity: fade }} className="mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-mustard uppercase"
        >
          <Flame className="h-4 w-4 animate-flicker" /> Open now · Fresh off the flat-top
        </motion.p>
        <h1 className="mt-5 max-w-3xl text-6xl leading-[0.88] font-black uppercase sm:text-7xl lg:text-8xl">
          {["Fast food,", "made the", "slow way."].map((line, i) => (
            <motion.span
              key={line}
              className={cn("block", i === 2 && "text-primary")}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {line}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 max-w-md text-lg text-cream/80"
        >
          Beef ground every morning. Chicken brined for 12 hours. Dough proofed for 48. Ready in about 15 minutes.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <StartOrder />
        </motion.div>
      </motion.div>
    </section>
  );
}

function StartOrder() {
  const cart = useCart();
  return (
    <div className="mt-8 w-full max-w-md rounded-3xl bg-card p-2 text-charcoal shadow-lift">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="How do you want your order?">
        {(["delivery", "pickup"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={cart.fulfillment === f}
            onClick={() => cart.setFulfillment(f)}
            className={cn(
              "relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold capitalize transition",
              cart.fulfillment === f ? "text-primary-foreground" : "text-charcoal/70 hover:text-charcoal",
            )}
          >
            {cart.fulfillment === f && <motion.span layoutId="hero-fulfil" className="absolute inset-0 rounded-xl bg-primary" />}
            <span className="relative flex items-center gap-2">
              {f === "delivery" ? <Bike className="h-4 w-4" /> : <StoreIcon className="h-4 w-4" />} {f}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clock className="h-4 w-4 text-primary" />
          {cart.fulfillment === "delivery" ? "Delivered in ~30 min" : "Ready in ~15 min"}
        </p>
        <Button asChild variant="hero">
          <Link to="/menu">
            Start order <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">The menu</p>
          <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">What are you craving?</h2>
        </div>
        <Link to="/menu" className="flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          Full menu <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>
      <Stagger className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-6">
        {CATEGORIES.map((c, i) => (
          <StaggerItem key={c.id} className={cn(i < 2 ? "md:col-span-3" : "md:col-span-2", i === 4 && "col-span-2 md:col-span-2")}>
            <Link
              to="/menu"
              search={{ cat: c.id }}
              className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-charcoal shadow-card md:aspect-auto md:h-80"
            >
              <img
                src={CATEGORY_IMAGES[c.id]}
                alt=""
                width={1024}
                height={1024}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                <h3 className="text-2xl leading-none font-black uppercase sm:text-3xl">{c.short}</h3>
                <p className="mt-1.5 hidden text-sm text-cream/75 sm:block">{c.blurb}</p>
              </div>
              <span className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:-rotate-45">
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Featured() {
  const { data } = useQuery(menuQuery());
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const featured = (data ?? []).filter((i) => i.is_featured).slice(0, 4);
  if (featured.length === 0) return null;
  return (
    <section className="bg-cream-deep/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Crowd favorites</p>
          <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">The ones people drive for</h2>
        </Reveal>
        <Stagger className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((item) => (
            <StaggerItem key={item.id}>
              <MenuCard item={item} onSelect={setSelected} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <ItemCustomizer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function Heritage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const facts = [
    { n: "6am", t: "Potatoes hand-cut every morning" },
    { n: "500°", t: "Flat-top smash for the crust" },
    { n: "48h", t: "Slow-proofed pizza dough" },
    { n: "18h", t: "Cold brew steep time" },
  ];
  return (
    <section ref={ref} className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift">
        <motion.img
          src={kitchenGrill}
          alt="Burgers being smashed on the Grill & Swill flat-top"
          width={1536}
          height={1024}
          loading="lazy"
          style={{ y, scale: 1.15 }}
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-4 left-4 rounded-full bg-cream px-4 py-2 text-xs font-bold tracking-widest uppercase">
          Since 1994
        </div>
      </div>
      <Reveal>
        <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Our kitchen</p>
        <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">No freezers. No heat lamps. No shortcuts.</h2>
        <p className="mt-5 max-w-lg text-lg text-charcoal/75">
          We started as one roadside grill with a hand-painted sign. The recipe hasn't changed: fresh beef, real buttermilk,
          dough that takes its time, and a crew that cooks your order when you place it.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4">
          {facts.map((f) => (
            <div key={f.n} className="rounded-2xl bg-card p-5 shadow-card">
              <dt className="font-display text-4xl font-black text-primary">{f.n}</dt>
              <dd className="mt-1 text-sm font-semibold text-muted-foreground">{f.t}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

function RewardsTeaser() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-flame p-8 text-primary-foreground sm:p-14">
        <Flame className="absolute -right-10 -bottom-10 h-72 w-72 opacity-15" strokeWidth={1} />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase opacity-80">Swill Rewards</p>
            <h2 className="mt-2 text-4xl font-black uppercase sm:text-6xl">Eat. Earn. Repeat.</h2>
            <p className="mt-4 max-w-md text-lg opacity-90">
              Every $1 earns {POINTS_PER_DOLLAR} points — no account, no password. Points are saved on this device and
              redeem right at checkout.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="cream" size="lg">
                <Link to="/rewards">See my points</Link>
              </Button>
              <Button asChild variant="outline-light" size="lg">
                <Link to="/deals">Today's deals</Link>
              </Button>
            </div>
          </div>
          <ul className="grid gap-2">
            {REWARD_TIERS.map((t) => (
              <li key={t.points} className="flex items-center justify-between rounded-2xl bg-charcoal/25 px-5 py-3 backdrop-blur-sm">
                <span className="font-semibold">{t.label}</span>
                <span className="font-display font-black tabular-nums">{t.points} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <div className="mx-auto mt-6 flex max-w-7xl items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        <Link to="/locations" className="hover:text-charcoal hover:underline">
          Find your nearest Grill & Swill
        </Link>
      </div>
    </section>
  );
}
