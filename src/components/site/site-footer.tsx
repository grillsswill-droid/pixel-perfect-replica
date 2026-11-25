import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="bg-charcoal text-cream">
      <div className="checker-border" />
      <div className="footer-order">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between md:py-16">
          <div data-reveal="heading">
            <h2 className="font-display font-black uppercase">Your next favourite is on the grill.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/70 sm:text-base">
              Browse every burger, pizza, side and sweet treat, then choose pickup or delivery at checkout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3" data-reveal="right">
            <Button asChild variant="hero" size="lg">
              <Link to="/menu">Start an order <ArrowRight /></Link>
            </Button>
            <Button asChild variant="outline-light" size="lg">
              <Link to="/locations"><MapPin /> Find a grill</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-cream/70">
            Smashed burgers, crispy chicken, wood-fired pizza and serious coffee. Fast food, made
            the slow way.
          </p>
        </div>
        <div>
          <h3 className="font-display text-sm font-black tracking-wider text-primary uppercase">
            Eat
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>
              <Link to="/menu" className="hover:text-cream">
                Full menu
              </Link>
            </li>
            <li>
              <Link to="/catering" className="hover:text-cream">
                Catering
              </Link>
            </li>
            <li>
              <Link to="/deals" className="hover:text-cream">
                Deals
              </Link>
            </li>
            <li>
              <Link to="/gallery" className="hover:text-cream">
                Gallery
              </Link>
            </li>
            <li>
              <Link to="/rewards" className="hover:text-cream">
                Rewards
              </Link>
            </li>
            <li>
              <Link to="/account/orders" className="hover:text-cream">
                Order history
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-black tracking-wider text-primary uppercase">
            Visit
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>
              <Link to="/locations" className="hover:text-cream">
                Find a store
              </Link>
            </li>
            <li>
              <Link to="/kitchen" className="hover:text-cream">
                Kitchen staff
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-cream">
                Admin dashboard
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-black tracking-wider text-primary uppercase">
            Open late
          </h3>
          <p className="mt-3 text-sm text-cream/80">
            Hours vary by location. Check your nearest grill before visiting.
          </p>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-cream/50 sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Grill & Swill Fast Food. All rights reserved.</span>
          <span>Payments are securely processed by Flutterwave.</span>
        </div>
      </div>
    </footer>
  );
}
