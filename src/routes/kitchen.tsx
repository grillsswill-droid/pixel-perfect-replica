import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChefHat, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getKitchenBoard,
  lockKitchen,
  setItemAvailability,
  setOrderStatus,
  unlockKitchen,
} from "@/lib/staff.functions";
import { nextStatus, statusLabel, type OrderStatus } from "@/lib/order-status";
import { formatMoney } from "@/lib/pricing";
import type { Fulfillment, OrderLineSnapshot } from "@/lib/menu-types";

type Board = Awaited<ReturnType<typeof getKitchenBoard>>;
type UnlockedBoard = Extract<Board, { unlocked: true }>;

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [
    { title: "Kitchen | Grill & Swill" },
    { name: "description", content: "Grill & Swill kitchen order queue." },
    { property: "og:title", content: "Kitchen | Grill & Swill" },
    { property: "og:description", content: "Grill & Swill kitchen order queue." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: KitchenPage,
});

function KitchenPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setBoard(await getKitchenBoard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "The kitchen board couldn't be loaded.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!board?.unlocked) return;
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [board?.unlocked, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await unlockKitchen({ data: { passcode } });
      if (!result.ok) {
        setError("That passcode didn't match. Try again.");
        return;
      }
      setPasscode("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The kitchen screen couldn't be unlocked.");
    } finally {
      setBusy(false);
    }
  }

  async function updateOrder(id: string, status: OrderStatus) {
    setBusy(true);
    try {
      await setOrderStatus({
        data: {
          id,
          status: status as "received" | "kitchen" | "handoff" | "completed" | "cancelled",
        },
      });
      await refresh();
      toast.success("Order status updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the order.");
    } finally {
      setBusy(false);
    }
  }

  async function updateAvailability(id: string, available: boolean) {
    setBusy(true);
    try {
      await setItemAvailability({ data: { id, available } });
      await refresh();
      toast.success(available ? "Item is back on the menu" : "Item marked sold out");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update inventory.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await lockKitchen();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lock the kitchen screen.");
    } finally {
      setBusy(false);
    }
  }

  if (!board || !board.unlocked) {
    return (
      <main className="grid min-h-[65vh] place-items-center bg-background px-5 py-12">
        <form
          onSubmit={login}
          className="w-full max-w-md rounded-3xl bg-card p-7 shadow-card sm:p-9"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
            <ShieldCheck />
          </span>
          <p className="mt-6 text-xs font-black tracking-[0.17em] text-primary uppercase">
            Staff only
          </p>
          <h1 className="font-display mt-2 text-3xl font-black uppercase">Kitchen access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your team passcode to manage the live order queue.
          </p>
          <label htmlFor="staff-passcode" className="mt-6 block text-sm font-bold">
            Staff passcode
          </label>
          <input
            id="staff-passcode"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
            className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="hero" size="lg" loading={busy} className="mt-5 w-full">
            Unlock kitchen
          </Button>
          <Link
            to="/"
            className="mt-5 block text-center text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            Back to storefront
          </Link>
        </form>
      </main>
    );
  }

  const activeBoard = board as UnlockedBoard;
  const openOrders = activeBoard.orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const closedOrders = activeBoard.orders.filter(
    (order) => order.status === "completed" || order.status === "cancelled",
  );

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-10 text-cream sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary">
              <ChefHat />
            </span>
            <div>
              <p className="text-xs font-black tracking-widest text-primary uppercase">
                Staff dashboard
              </p>
              <h1 className="font-display text-3xl font-black uppercase">Kitchen board</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline-light" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline-light" onClick={() => void logout()} disabled={busy}>
              <LogOut className="h-4 w-4" /> Lock screen
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-black tracking-widest text-primary uppercase">
                  Incoming
                </p>
                <h2 className="font-display text-2xl font-black uppercase">
                  Active orders <span className="text-primary">({openOrders.length})</span>
                </h2>
              </div>
            </div>
            {openOrders.length === 0 ? (
              <div className="rounded-3xl bg-card p-8 text-center shadow-card">
                <p className="font-display text-xl font-black uppercase">All caught up</p>
                <p className="mt-2 text-sm text-muted-foreground">New orders will show up here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {openOrders.map((order) => {
                    const status = order.status;
                    const next = nextStatus(status);
                    const items = order.items as OrderLineSnapshot[];
                    return (
                      <motion.article
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-3xl bg-card p-5 shadow-card sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-2xl font-black">
                              #{order.order_number}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {order.customer_name} · {order.fulfillment}
                            </p>
                            {order.customer_phone ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {order.customer_phone}
                              </p>
                            ) : null}
                            {order.address ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {order.address.street}, {order.address.city}, {order.address.state}{" "}
                                {order.address.zip}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-primary">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={status}
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 3 }}
                                transition={{ duration: 0.14 }}
                                className="block"
                              >
                                {statusLabel(status, order.fulfillment as Fulfillment)}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </div>
                        <ul className="mt-4 space-y-2 border-y border-border py-4 text-sm">
                          {items.map((item, index) => (
                            <li key={`${item.itemId}-${index}`}>
                              <span className="font-bold">{item.quantity} ×</span> {item.name}
                              {item.bundleComponents?.length ? (
                                <span className="block pl-8 text-xs text-muted-foreground">
                                  Includes:{" "}
                                  {item.bundleComponents
                                    .map(
                                      (component) => `${component.quantity} × ${component.label}`,
                                    )
                                    .join(" · ")}
                                </span>
                              ) : null}
                              {item.summary.length > 0 && (
                                <span className="block pl-8 text-xs text-muted-foreground">
                                  {item.summary.join(" · ")}
                                </span>
                              )}
                              {item.note ? (
                                <span className="block pl-8 text-xs font-semibold text-primary">
                                  Note: {item.note}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="font-bold">{formatMoney(order.total_cents)}</span>
                          {next && (
                            <Button
                              variant="hero"
                              size="sm"
                              onClick={() => void updateOrder(order.id, next)}
                              disabled={busy}
                            >
                              Move to {statusLabel(next, order.fulfillment as Fulfillment)}{" "}
                              <ArrowRight />
                            </Button>
                          )}
                          {status !== "cancelled" && status !== "completed" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void updateOrder(order.id, "cancelled")}
                              disabled={busy}
                            >
                              Cancel order
                            </Button>
                          ) : null}
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
            {closedOrders.length ? (
              <section className="mt-8">
                <p className="text-xs font-black tracking-widest text-primary uppercase">
                  Recent activity
                </p>
                <h2 className="font-display mb-3 text-xl font-black uppercase">
                  Completed &amp; cancelled
                </h2>
                <ul className="divide-y divide-border rounded-2xl bg-card px-4 shadow-card">
                  {closedOrders.slice(0, 12).map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                    >
                      <span>
                        <b>#{order.order_number}</b> · {order.customer_name}
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {statusLabel(order.status, order.fulfillment as Fulfillment)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <aside>
            <p className="text-xs font-black tracking-widest text-primary uppercase">86 board</p>
            <h2 className="font-display mb-4 text-2xl font-black uppercase">Menu availability</h2>
            <div className="divide-y divide-border rounded-3xl bg-card px-5 shadow-card">
              {activeBoard.menu.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(item.price_cents)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void updateAvailability(item.id, !item.is_available)}
                    disabled={busy}
                    aria-pressed={item.is_available}
                    className={`rounded-full px-3 py-2 text-xs font-bold transition ${item.is_available ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive" : "bg-destructive/10 text-destructive hover:bg-success/10 hover:text-success"}`}
                  >
                    {item.is_available ? "Available" : "Sold out"}
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
