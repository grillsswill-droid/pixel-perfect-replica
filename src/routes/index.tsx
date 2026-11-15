import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, BadgeCheck, Clock3, Flame, MapPin, Sparkles, Truck } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import heroFeast from "@/assets/hero-feast.jpg";
import kitchenGrill from "@/assets/kitchen-grill.jpg";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { CATEGORY_IMAGES } from "@/lib/food-images";
import { CATEGORIES } from "@/lib/menu-types";

const rewardTiers = [
  { points: 250, label: "Free fries or lemonade", value: "$2.50 off" },
  { points: 500, label: "Any coffee or shake", value: "$5 off" },
  { points: 900, label: "Any burger or sandwich", value: "$9 off" },
  { points: 1500, label: "Any 16\" pizza", value: "$15 off" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grill & Swill | Fast food, made the slow way" },
      {
        name: "description",
        content: "Smash burgers, crispy chicken, wood-fired pizza and serious coffee. Order fresh from Grill & Swill.",
      },
      { property: "og:title", content: "Grill & Swill | Fast food, made the slow way" },
      { property: "og:description", content: "Fresh burger, chicken, pizza and coffee made for pickup or delivery." },
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
      <Heritage />
      <RewardsTeaser />
    </>
  );
}

function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);

  return (
    <section ref={heroRef} className="relative isolate min-h-[680px] overflow-hidden bg-charcoal text-cream sm:min-h-[760px]">
      <motion.div style={{ y: imageY }} className="absolute inset-0 -z-20 h-[116%]">
        <img src={heroFeast} alt="" className="h-full w-full object-cover object-center opacity-60" fetchPriority="high" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal via-charcoal/80 to-charcoal/15" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/75 via-transparent to-charcoal/10" />

      <div className="mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-20 sm:min-h-[760px] sm:px-8">
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
            className="max-w-3xl text-6xl leading-[0.9] font-black tracking-[-0.06em] uppercase sm:text-8xl lg:text-[108px]"
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
            Smash burgers, hand-breaded chicken, 48-hour pizza dough. Made fresh, served fast, and worth getting your hands messy for.
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
            <Link to="/locations" className="inline-flex items-center gap-2 px-2 py-3 text-sm font-bold text-cream transition hover:text-primary">
              <MapPin className="h-4 w-4" /> Find your nearest grill
            </Link>
          </motion.div>

          <div className="mt-12 flex items-center gap-3 text-xs font-semibold tracking-wide text-cream/65">
            <span className="flex -space-x-2">
              {[
                { label: "Burger", icon: "🍔" },
                { label: "Pizza", icon: "🍕" },
                { label: "Chicken", icon: "🍗" },
              ].map((item) => (
                <span
                  key={item.label}
                  aria-label={item.label}
                  className="grid h-9 w-9 place-items-center rounded-full border-2 border-charcoal bg-cream text-base"
                >
                  {item.icon}
                </span>
              ))}
            </span>
            <span>Good things are happening on the grill</span>
          </div>
        </div>
      </div>

      <a href="#menu-favorites" className="absolute right-8 bottom-8 hidden items-center gap-2 text-xs font-bold tracking-widest text-cream/70 uppercase transition hover:text-cream sm:flex">
        Scroll for the good stuff <ArrowDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}

function CategoryGrid() {
  return (
    <section id="menu-favorites" className="bg-cream px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-black tracking-[0.2em] text-primary uppercase">The good stuff</p>
            <h2 className="text-4xl leading-none font-black uppercase sm:text-6xl">What sounds good?</h2>
          </div>
          <Link to="/menu" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3">
            See the whole menu <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
          {CATEGORIES.map((category, index) => (
            <Reveal key={category.id} delay={index * 0.06}>
              <Link to="/menu" className="group relative block aspect-[0.83] overflow-hidden rounded-3xl bg-charcoal shadow-card">
                <img
                  src={CATEGORY_IMAGES[category.id]}
                  alt={category.label}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-110 group-hover:opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-cream sm:p-5">
                  <p className="text-xl leading-none font-black uppercase sm:text-2xl">{category.short}</p>
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
          <p className="mb-3 text-xs font-black tracking-[0.2em] text-cream/65 uppercase">The long way is the right way</p>
          <h2 className="max-w-xl text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
            Fast food.
            <br />
            Slow-made.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/80">
            We grind our beef every morning, hand-cut potatoes before the doors open, and give our dough the time it deserves. You can taste the difference.
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
  );
}

function RewardsTeaser() {
  return (
    <section className="bg-cream px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-r border-charcoal/10 bg-charcoal px-6 py-8 text-cream sm:px-8 sm:py-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-black tracking-[0.2em] text-primary uppercase">
                <Sparkles className="h-4 w-4" /> The Swill Club
              </p>
              <h2 className="text-4xl leading-none font-black uppercase sm:text-5xl">Every bite brings you closer.</h2>
              <p className="mt-4 text-cream/75">
                Earn 10 points for every dollar. Get a little something on us when you come back hungry.
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
              <div key={tier.points} className="rounded-2xl border border-cream/10 bg-cream/5 p-4 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-[0.2em] text-primary uppercase">{tier.points} pts</p>
                  <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cream">Reward</span>
                </div>
                <p className="mt-4 text-base font-black text-cream">{tier.label}</p>
                <p className="mt-1 text-sm text-cream/65">{tier.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Reveal className="rounded-[1.6rem] border border-charcoal/10 bg-white p-5 shadow-card">
            <Clock3 className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Fast pickup</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Warm, ready-to-go bags in about 15 minutes, even on the busiest lunch rush.</p>
          </Reveal>

          <Reveal delay={0.07} className="rounded-[1.6rem] border border-charcoal/10 bg-white p-5 shadow-card">
            <Truck className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Fresh delivery</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Local drops from your nearest grill, with free delivery over $35.</p>
          </Reveal>

          <Reveal delay={0.14} className="rounded-[1.6rem] border border-charcoal/10 bg-white p-5 shadow-card">
            <BadgeCheck className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-2xl font-black uppercase">Always consistent</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Fresh ingredients, time-tested recipes, and a kitchen built for speed.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
