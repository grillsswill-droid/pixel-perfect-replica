import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Gift, RotateCcw, Star } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/site/reveal";
import { useCart } from "@/hooks/use-cart";
import { useGuestId } from "@/hooks/use-guest";
import { getMenu } from "@/lib/catalog.functions";
import { getGuestRewards } from "@/lib/orders.functions";
import {
  formatMoney,
  memberLevel,
  REWARD_TIERS,
  selectionSummary,
  unitPriceCents,
} from "@/lib/pricing";
import type { Fulfillment, OrderLineSnapshot } from "@/lib/menu-types";

type RewardsData = Awaited<ReturnType<typeof getGuestRewards>>;

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Swill Club Rewards | Grill & Swill" },
      { name: "description", content: "Earn points every time you eat well." },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const guestId = useGuestId();
  const cart = useCart();
  const [data, setData] = useState<RewardsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) return;
    let active = true;
    setLoading(true);
    getGuestRewards({ data: { guestId } })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("Rewards are having a little trouble loading. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [guestId]);

  const level = memberLevel(data?.lifetimePoints ?? 0);
  const toNextLevel = level.next ? Math.max(0, level.next.min - (data?.lifetimePoints ?? 0)) : 0;
  const levelProgress = level.next
    ? Math.min(
        100,
        (((data?.lifetimePoints ?? 0) - level.current.min) / (level.next.min - level.current.min)) *
          100,
      )
    : 100;

  async function reorder(
    orderId: string,
    fulfillment: Fulfillment,
    storeId: string | null,
    lines: OrderLineSnapshot[],
  ) {
    setReordering(orderId);
    try {
      const menu = await getMenu();
      const currentItems = new Map(menu.map((item) => [item.id, item]));
      const linesToAdd = lines.map((line) => {
        const item = currentItems.get(line.itemId);
        if (!item || !item.is_available) {
          throw new Error(`${line.name} is no longer available. Nothing was added.`);
        }
        return {
          itemId: item.id,
          slug: item.slug,
          category: item.category,
          name: item.name,
          imageKey: item.image_key,
          quantity: line.quantity,
          selections: line.selections,
          removed: line.removed,
          note: line.note,
          unitPriceCents: unitPriceCents(item, line.selections),
          summary: selectionSummary(item, line.selections, line.removed),
        };
      });
      linesToAdd.forEach((line) => cart.addLine(line));
      cart.setFulfillment(fulfillment);
      cart.setStoreId(storeId);
      cart.setOpen(true);
      toast.success("Your past order is back in your bag");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That order couldn't be added to your bag.");
    } finally {
      setReordering(null);
    }
  }

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-14 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-black tracking-[0.2em] text-primary uppercase">
              <Star className="h-4 w-4" /> The Swill Club
            </p>
            <h1 className="font-display mt-3 text-5xl leading-[0.9] font-black uppercase sm:text-7xl">
              Good bites.
              <br />
              Great perks.
            </h1>
            <p className="mt-5 max-w-xl text-cream/70">
              Earn 10 points for every dollar. Your rewards are saved on this device—no account, no
              fuss.
            </p>
          </div>
          <div className="min-w-60 rounded-3xl border border-cream/15 bg-cream/5 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-cream/70">Your points</span>
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <p className="font-display mt-2 text-5xl font-black tabular-nums">
              {loading ? "…" : (data?.points ?? 0).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-cream/60">Worth {formatMoney(data?.points ?? 0)}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-cream/15">
              <motion.div
                className="h-full origin-left rounded-full bg-primary"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: levelProgress / 100 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="mt-2 text-xs text-cream/60">
              {level.next
                ? `${toNextLevel} points to ${level.next.name}`
                : "You’ve reached the top tier."}
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-primary uppercase">
              Worth the wait
            </p>
            <h2 className="font-display mt-2 text-3xl font-black uppercase sm:text-4xl">
              Pick your reward
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Current tier: <span className="font-bold text-charcoal">{level.current.name}</span>
          </p>
        </div>
        <Stagger className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REWARD_TIERS.map((tier) => (
            <StaggerItem key={tier.points} className="h-full">
              <article className="h-full rounded-3xl bg-card p-5 shadow-card">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary">
                  <Gift />
                </span>
                <p className="font-display mt-5 text-2xl font-black uppercase">{tier.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tier.value}</p>
                <p className="mt-5 border-t border-border pt-4 text-sm font-bold">
                  {tier.points} points
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl bg-card p-6 shadow-card">
            <h2 className="font-display text-2xl font-black uppercase">Recent orders</h2>
            {error ? (
              <p role="alert" className="mt-5 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {!error && !loading && (data?.orders.length ?? 0) === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Your next favorite is just around the corner.
              </p>
            )}
            <ul className="mt-4 divide-y divide-border">
              {(data?.orders ?? []).map((order) => {
                const items = order.items as unknown as OrderLineSnapshot[];
                return (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-bold">Order #{order.order_number}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold">{formatMoney(order.total_cents)}</p>
                        <p className="mt-1 text-xs text-primary">+{order.points_earned} points</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={reordering === order.id}
                        disabled={reordering !== null}
                        onClick={() =>
                          void reorder(
                            order.id,
                            order.fulfillment as Fulfillment,
                            order.store_id,
                            items,
                          )
                        }
                        aria-label={`Reorder ${order.order_number}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <aside className="flex flex-col items-start justify-center rounded-3xl bg-accent p-7">
            <p className="text-xs font-black tracking-[0.17em] text-primary uppercase">
              Keep the good going
            </p>
            <h2 className="font-display mt-3 text-3xl leading-tight font-black uppercase">
              Your usual, just a few taps away.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your orders stay right here on this device, ready when you are.
            </p>
            <Button asChild variant="hero" className="mt-7">
              <Link to="/menu">
                Order again <ArrowRight />
              </Link>
            </Button>
          </aside>
        </div>
      </section>
    </main>
  );
}
