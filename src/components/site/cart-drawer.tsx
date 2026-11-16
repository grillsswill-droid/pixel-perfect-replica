import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bike, ShoppingBag, Store, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCheckoutConfiguration } from "@/lib/admin.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { foodImage } from "@/lib/food-images";
import { FREE_DELIVERY_THRESHOLD_CENTS, formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";

export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const { data: config } = useQuery({
    queryKey: ["checkout-configuration"],
    queryFn: () => getCheckoutConfiguration(),
    staleTime: 60_000,
  });
  const threshold = config?.freeDeliveryThresholdCents ?? FREE_DELIVERY_THRESHOLD_CENTS;
  const remaining = Math.max(0, threshold - cart.subtotalCents);
  const progress = threshold === 0 ? 100 : Math.min(100, (cart.subtotalCents / threshold) * 100);

  return (
    <Sheet open={cart.isOpen} onOpenChange={cart.setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l-0 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle className="font-display text-2xl font-black uppercase">Your Bag</SheetTitle>
          <SheetDescription>
            {cart.count === 0
              ? "Nothing here yet."
              : `${cart.count} item${cart.count === 1 ? "" : "s"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pt-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
            role="radiogroup"
            aria-label="How do you want it?"
          >
            {(["delivery", "pickup"] as const).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={cart.fulfillment === f}
                onClick={() => cart.setFulfillment(f)}
                className={cn(
                  "relative flex items-center justify-center gap-2 rounded-full py-2 text-sm font-bold capitalize transition",
                  cart.fulfillment === f ? "text-primary-foreground" : "text-charcoal/70",
                )}
              >
                {cart.fulfillment === f && (
                  <motion.span
                    layoutId="drawer-fulfil"
                    className="absolute inset-0 rounded-full bg-primary"
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {f === "delivery" ? <Bike className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                  {f}
                </span>
              </button>
            ))}
          </div>
          {cart.fulfillment === "delivery" && cart.count > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {remaining > 0
                  ? `${formatMoney(remaining)} away from free delivery`
                  : "You unlocked free delivery"}
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-flame"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-muted">
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
              <p className="font-display text-xl font-black uppercase">Hungry?</p>
              <p className="max-w-60 text-sm text-muted-foreground">
                Add a smash burger, a pie, or an 18-hour cold brew to get started.
              </p>
              <Button asChild variant="hero" onClick={() => cart.setOpen(false)}>
                <Link to="/menu">Browse the menu</Link>
              </Button>
              <Link
                to="/rewards"
                onClick={() => cart.setOpen(false)}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Reorder a past favorite
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {cart.lines.map((line) => (
                  <motion.li
                    key={line.key}
                    layout
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30, height: 0, marginTop: 0 }}
                    className="flex gap-3 rounded-2xl bg-card p-3 shadow-card"
                  >
                    {foodImage(line.imageKey, line.slug) ? (
                      <img
                        src={foodImage(line.imageKey, line.slug)}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display leading-tight font-bold">{line.name}</p>
                        <p className="font-bold tabular-nums">
                          {formatMoney(line.unitPriceCents * line.quantity)}
                        </p>
                      </div>
                      {line.bundleComponents && line.bundleComponents.length > 0 && (
                        <ul className="mt-1 text-xs text-muted-foreground">
                          {line.bundleComponents.map((component, index) => (
                            <li key={`${component.label}-${index}`}>
                              {component.quantity} × {component.label}
                            </li>
                          ))}
                        </ul>
                      )}
                      {line.summary.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {line.summary.join(" · ")}
                        </p>
                      )}
                      {line.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground italic">"{line.note}"</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          onChange={(q) => cart.updateQuantity(line.key, q)}
                          min={0}
                        />
                        <button
                          type="button"
                          onClick={() => cart.removeLine(line.key)}
                          className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t bg-card px-6 py-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-display text-xl font-black tabular-nums">
                {formatMoney(cart.subtotalCents)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tax, fees, promos and points are applied at checkout.
            </p>
            <Button
              variant="hero"
              size="xl"
              className="mt-4 w-full"
              onClick={() => {
                cart.setOpen(false);
                navigate({ to: "/checkout" });
              }}
            >
              Checkout · {formatMoney(cart.subtotalCents)}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
