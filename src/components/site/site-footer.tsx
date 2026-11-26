import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStorefrontLocations } from "@/hooks/use-storefront-locations";
import { useCustomerSite } from "@/hooks/use-customer-site";
import { customerPolicyLinks, supportMailto } from "@/lib/customer-site";
import { Logo } from "./logo";

export function SiteFooter() {
  const { hasLocations } = useStorefrontLocations();
  const { supportEmail, supportHours } = useCustomerSite();
  return (
    <footer className="bg-charcoal text-cream">
      <div className="checker-border" />
      <div className="footer-order">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between md:py-16">
          <div data-reveal="heading">
            <h2 className="font-display font-black uppercase">
              Your next favourite is on the grill.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/70 sm:text-base">
              Browse every burger, pizza, side and sweet treat, then{" "}
              {hasLocations ? "choose pickup or delivery" : "arrange delivery"} at checkout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3" data-reveal="right">
            <Button asChild variant="hero" size="lg">
              <Link to="/menu">
                Start an order <ArrowRight />
              </Link>
            </Button>
            {hasLocations ? (
              <Button asChild variant="outline-light" size="lg">
                <Link to="/locations">
                  <MapPin /> Find a grill
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_0.75fr_1fr_1.2fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-cream/70">
            Smashed burgers, crispy chicken, wood-fired pizza and serious coffee. Fast food, made
            the slow way.
          </p>
          <a
            href={supportMailto(supportEmail)}
            className="mt-4 inline-flex min-h-11 items-center break-all text-sm font-semibold text-cream underline underline-offset-4 hover:text-primary"
          >
            {supportEmail}
          </a>
          {supportHours ? <p className="mt-2 text-sm text-cream/80">{supportHours}</p> : null}
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
            Help
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>
              <Link to="/faq" className="inline-flex min-h-11 items-center hover:text-cream">
                Frequently asked questions
              </Link>
            </li>
            <li>
              <Link to="/support" className="inline-flex min-h-11 items-center hover:text-cream">
                Contact support
              </Link>
            </li>
            {hasLocations ? (
              <li>
                <Link to="/locations" className="hover:text-cream">
                  Find a store
                </Link>
              </li>
            ) : null}
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
            Customer policies
          </h3>
          <ul className="mt-3 text-sm text-cream/80">
            {customerPolicyLinks(hasLocations).map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className="inline-flex min-h-11 items-center leading-5 hover:text-cream"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-cream/50 sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Grill & Swill Fast Food. All rights reserved.</span>
          <span>Payments processed by Flutterwave.</span>
        </div>
      </div>
    </footer>
  );
}
