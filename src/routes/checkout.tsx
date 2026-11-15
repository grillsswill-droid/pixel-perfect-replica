import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bike, CreditCard, Store } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useGuestId } from "@/hooks/use-guest";
import { getStores } from "@/lib/catalog.functions";
import { getGuestRewards, placeOrder, type DeliveryAddress } from "@/lib/orders.functions";
import { computeTotals, formatMoney } from "@/lib/pricing";
import type { Fulfillment } from "@/lib/menu-types";

export const Route = createFileRoute("/checkout")({
  loader: () => getStores(),
  head: () => ({
    meta: [
      { title: "Checkout | Grill & Swill" },
      { name: "description", content: "Finish your Grill & Swill order." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const stores = Route.useLoaderData();
  const cart = useCart();
  const guestId = useGuestId();
  const navigate = useNavigate();
  const [fulfillment, setFulfillment] = useState<Fulfillment>(cart.fulfillment);
  const [storeId, setStoreId] = useState(cart.storeId ?? stores[0]?.id ?? "");
  const [promoCode, setPromoCode] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [address, setAddress] = useState<DeliveryAddress>({
    name: "",
    street: "",
    unit: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    instructions: "",
  });
  const [pickupName, setPickupName] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!guestId) return;
    let active = true;
    getGuestRewards({ data: { guestId } })
      .then((rewards) => {
        if (active) setAvailablePoints(rewards.points);
      })
      .catch(() => {
        if (active) setRewardsError("Your points balance couldn't be loaded.");
      });
    return () => {
      active = false;
    };
  }, [guestId]);

  let total = cart.subtotalCents;
  let pricingError: string | null = null;
  try {
    total = computeTotals({
      lines: cart.lines.map((line) => ({
        category: line.category,
        lineTotalCents: line.unitPriceCents * line.quantity,
      })),
      fulfillment,
      promoCode,
      pointsToRedeem,
      availablePoints,
    }).totalCents;
  } catch (e) {
    pricingError = e instanceof Error ? e.message : "The estimate couldn't be calculated.";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await placeOrder({
        data: {
          guestId,
          lines: cart.lines.map(({ itemId, quantity, selections, removed, note }) => ({
            itemId,
            quantity,
            selections,
            removed,
            note,
          })),
          fulfillment,
          storeId,
          address: fulfillment === "delivery" ? address : null,
          ...(fulfillment === "pickup" ? { pickupName } : {}),
          promoCode: promoCode.trim() || null,
          pointsToRedeem,
          paymentLast4,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      cart.clear();
      cart.setFulfillment(fulfillment);
      cart.setStoreId(storeId);
      await navigate({ to: "/orders/$id", params: { id: result.orderId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.hydrated) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5" aria-busy="true">
        <p className="font-display text-xl font-black uppercase">Loading your bag…</p>
      </main>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5">
        <div className="text-center">
          <h1 className="font-display text-4xl font-black uppercase">Your bag is empty</h1>
          <p className="mt-2 text-muted-foreground">Add something delicious before checking out.</p>
          <Button asChild variant="hero" className="mt-6">
            <Link to="/menu">Browse the menu</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[65vh] bg-background">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <Link
          to="/menu"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to menu
        </Link>
        <h1 className="font-display mt-5 text-4xl font-black uppercase sm:text-5xl">
          A few last details.
        </h1>
        <form onSubmit={submit} className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-3xl bg-card p-5 shadow-card sm:p-7">
              <h2 className="font-display text-xl font-black uppercase">How do you want it?</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["delivery", "pickup"] as const).map((method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setFulfillment(method)}
                    aria-pressed={fulfillment === method}
                    className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 font-bold capitalize transition ${fulfillment === method ? "border-primary bg-accent text-primary" : "border-border hover:border-primary/40"}`}
                  >
                    {method === "delivery" ? (
                      <Bike className="h-5 w-5" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                    {method}
                  </button>
                ))}
              </div>
              <label className="mt-5 block text-sm font-bold" htmlFor="store">
                Your Grill & Swill
              </label>
              <select
                id="store"
                required
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Choose a location
                </option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} · {store.city}, {store.state}
                  </option>
                ))}
              </select>
            </section>
            <section className="rounded-3xl bg-card p-5 shadow-card sm:p-7">
              <h2 className="font-display text-xl font-black uppercase">
                {fulfillment === "delivery" ? "Where should we bring it?" : "Who’s picking it up?"}
              </h2>
              {fulfillment === "delivery" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    name="name"
                    value={address.name}
                    onChange={(value) => setAddress({ ...address, name: value })}
                    required
                  />
                  <Field
                    label="Phone"
                    name="phone"
                    type="tel"
                    value={address.phone}
                    onChange={(value) => setAddress({ ...address, phone: value })}
                    required
                  />
                  <Field
                    label="Street address"
                    name="street"
                    value={address.street}
                    onChange={(value) => setAddress({ ...address, street: value })}
                    required
                    wide
                  />
                  <Field
                    label="Apt / unit (optional)"
                    name="unit"
                    value={address.unit ?? ""}
                    onChange={(value) => setAddress({ ...address, unit: value })}
                  />
                  <Field
                    label="City"
                    name="city"
                    value={address.city}
                    onChange={(value) => setAddress({ ...address, city: value })}
                    required
                  />
                  <Field
                    label="State"
                    name="state"
                    value={address.state}
                    onChange={(value) => setAddress({ ...address, state: value })}
                    required
                  />
                  <Field
                    label="ZIP code"
                    name="zip"
                    value={address.zip}
                    onChange={(value) => setAddress({ ...address, zip: value })}
                    required
                  />
                  <Field
                    label="Delivery instructions (optional)"
                    name="instructions"
                    value={address.instructions ?? ""}
                    onChange={(value) => setAddress({ ...address, instructions: value })}
                    wide
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <Field
                    label="Name for pickup"
                    name="pickup-name"
                    value={pickupName}
                    onChange={setPickupName}
                    required
                  />
                </div>
              )}
            </section>
            <section className="rounded-3xl bg-card p-5 shadow-card sm:p-7">
              <h2 className="font-display flex items-center gap-2 text-xl font-black uppercase">
                <CreditCard className="h-5 w-5 text-primary" /> Payment
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Demo checkout only. No card is charged; enter any four digits.
              </p>
              <label className="mt-4 block text-sm font-bold" htmlFor="last4">
                Card ending in
              </label>
              <input
                id="last4"
                value={paymentLast4}
                onChange={(e) => setPaymentLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
                placeholder="1234"
                className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-sm sm:max-w-52"
              />
            </section>
          </div>
          <aside className="rounded-3xl bg-card p-5 shadow-card lg:sticky lg:top-28">
            <h2 className="font-display text-xl font-black uppercase">Order summary</h2>
            <ul className="mt-4 space-y-3 border-b border-border pb-4">
              {cart.lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-3 text-sm">
                  <span>
                    {line.quantity} × {line.name}
                  </span>
                  <span className="shrink-0 font-bold">
                    {formatMoney(line.unitPriceCents * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <label htmlFor="promo" className="mt-4 block text-sm font-bold">
              Promo code
            </label>
            <input
              id="promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="SWILL5"
              className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm uppercase"
            />
            <label htmlFor="points" className="mt-4 block text-sm font-bold">
              Points to redeem
            </label>
            <input
              id="points"
              type="number"
              min={0}
              max={availablePoints}
              step={100}
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(Math.max(0, Number(e.target.value)))}
              className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
            {rewardsError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {rewardsError}
              </p>
            )}
            {pricingError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {pricingError}
              </p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="font-bold">Estimated total</span>
              <span className="font-display text-2xl font-black">{formatMoney(total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Final taxes and promotions are validated securely when you place your order.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="hero"
              size="xl"
              loading={submitting || !guestId}
              className="mt-5 w-full"
            >
              Place order · {formatMoney(total)}
            </Button>
          </aside>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  wide = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={`block text-sm font-bold ${wide ? "sm:col-span-2" : ""}`} htmlFor={name}>
      {label}
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}
