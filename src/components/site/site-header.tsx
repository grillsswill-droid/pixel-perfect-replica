import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Menu as MenuIcon, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { getCheckoutConfiguration } from "@/lib/admin.functions";
import { DEFAULT_TICKER_MESSAGES } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/deals", label: "Deals" },
  { to: "/catering", label: "Catering" },
  { to: "/gallery", label: "Gallery" },
  { to: "/locations", label: "Locations" },
  { to: "/rewards", label: "Rewards" },
] as const;

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: checkoutConfiguration } = useQuery({
    queryKey: ["checkout-configuration"],
    queryFn: () => getCheckoutConfiguration(),
    staleTime: 60_000,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const ticker = checkoutConfiguration?.tickerMessages ?? DEFAULT_TICKER_MESSAGES;

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  function closeDrawer() {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="sticky top-0 z-40">
      {ticker.length ? (
        <div className="overflow-hidden bg-charcoal py-1.5 text-cream">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] uppercase">
            {[...ticker, ...ticker].map((text, index) => (
              <span key={index} className="flex items-center gap-10">
                {text}
                <span className="text-primary" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled
            ? "border-border bg-card/95 backdrop-blur-md"
            : "border-border bg-card",
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.filter((item) => item.to !== "/").map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-3 py-2 text-sm font-bold text-charcoal/80 transition hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                activeProps={{ className: "text-charcoal" }}
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary"
                      />
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(true)}
              className="relative grid h-11 w-11 place-items-center rounded-full bg-card text-charcoal shadow-card transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-90"
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
            </Button>
            <Button asChild variant="hero" size="default" className="hidden sm:inline-flex">
              <Link to="/menu">Order Now</Link>
            </Button>
            <Button
              variant="ghost"
              ref={menuButtonRef}
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div
        id="mobile-navigation"
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeDrawer}
          className={`absolute inset-0 h-full w-full bg-charcoal/70 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          ref={drawerRef}
          aria-label="Mobile navigation"
          aria-modal="true"
          role="dialog"
          inert={!mobileOpen}
          className={`absolute right-0 top-0 flex h-dvh w-[88%] max-w-sm flex-col overflow-y-auto bg-charcoal p-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-cream shadow-2xl transition-transform duration-300 sm:p-7 ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="font-display text-sm font-black uppercase tracking-wider text-primary">
              Good food. No funny business.
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-cream transition hover:bg-cream/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-4 border-b border-cream/15 pb-5">
            <Logo light onClick={closeDrawer} />
          </div>
          <div className="flex flex-col">
            {NAV.map((item, index) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  style={{ transitionDelay: `${mobileOpen ? index * 45 : 0}ms` }}
                  aria-current={active ? "page" : undefined}
                  className={`font-display border-b border-cream/10 py-4 text-2xl font-black uppercase transition-all duration-300 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary ${
                    active ? "text-primary" : "text-cream"
                  } ${mobileOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/account/orders"
              onClick={() => setMobileOpen(false)}
              className="font-display border-b border-cream/10 py-4 text-2xl font-black uppercase text-cream transition hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              Your orders
            </Link>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button asChild variant="hero" size="lg" onClick={closeDrawer}>
              <Link to="/menu">Start an order</Link>
            </Button>
            <Button
              type="button"
              variant="outline-light"
              size="lg"
              onClick={() => {
                closeDrawer();
                setOpen(true);
              }}
            >
              <ShoppingBag className="h-4 w-4" />
              View bag{count ? ` (${count})` : ""}
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
