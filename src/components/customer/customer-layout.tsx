import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCustomerSite } from "@/hooks/use-customer-site";
import { supportMailto } from "@/lib/customer-site";

export function CustomerPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="border-b border-charcoal/15">
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16 sm:pb-12">
        <h1 className="max-w-4xl font-display text-4xl leading-[1.05] font-black text-balance uppercase sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
        <nav
          aria-label="Customer help"
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold"
        >
          <Link
            to="/faq"
            className="inline-flex min-h-11 items-center underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            FAQs
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-11 items-center underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Contact support
          </Link>
          <Link
            to="/account/orders"
            className="inline-flex min-h-11 items-center underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Your orders
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function CustomerContent({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">{children}</div>;
}

export function SupportHelp() {
  const { supportEmail } = useCustomerSite();
  return (
    <section className="mt-14 border-t border-charcoal/15 pt-8" aria-labelledby="more-help-heading">
      <h2 id="more-help-heading" className="font-display text-2xl font-black">
        Need help with your order?
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Tell us what happened and include your order reference if you have it. Keep card numbers,
        passwords and private tracking links out of your message.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild variant="hero">
          <Link to="/support">
            Contact support <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a href={supportMailto(supportEmail)}>
            <Mail aria-hidden="true" /> Email us
          </a>
        </Button>
      </div>
    </section>
  );
}
