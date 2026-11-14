import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Menu as MenuIcon, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { to: "/menu", label: "Menu" },
  { to: "/deals", label: "Deals" },
  { to: "/locations", label: "Locations" },
  { to: "/rewards", label: "Rewards" },
] as const;

const TICKER = [
  "Free delivery on orders $35+",
  "Code SWILL5 · $5 off $25",
  "Beef ground fresh every morning",
  "Earn 10 points per $1",
  "Potatoes cut by hand at 6am",
  "18-hour cold brew on tap",
];

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div className="overflow-hidden bg-charcoal py-1.5 text-cream">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] uppercase">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t}
              <span className="text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled ? "border-border bg-background/90 backdrop-blur-md" : "border-transparent bg-background",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="relative rounded-full px-4 py-2 text-sm font-semibold text-charcoal/80 transition hover:text-charcoal"
                activeProps={{ className: "text-charcoal" }}
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && (
                      <motion.span layoutId="nav-pill" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative grid h-11 w-11 place-items-center rounded-full bg-card text-charcoal shadow-card transition active:scale-90 hover:bg-muted"
              aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`}
            >
              <ShoppingBag className="h-5 w-5" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Button asChild variant="hero" size="default" className="hidden sm:inline-flex">
              <Link to="/menu">Order Now</Link>
            </Button>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t md:hidden"
              aria-label="Mobile"
            >
              <div className="flex flex-col gap-1 px-4 py-4">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="font-display rounded-xl px-3 py-3 text-2xl font-black uppercase hover:bg-muted">
                    {n.label}
                  </Link>
                ))}
                <Button asChild variant="hero" size="lg" className="mt-2">
                  <Link to="/menu">Order Now</Link>
                </Button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
