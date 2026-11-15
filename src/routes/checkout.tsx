import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bike,
  Check,
  CreditCard,
  Gift,
  Lock,
  MapPin,
  ShoppingBag,
  Store as StoreIcon,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";

import { Field } from "@/components/site/field";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useGuestId } from "@/hooks/use-guest";
import { getCheckoutConfiguration } from "@/lib/admin.functions";
import { storesQuery } from "@/lib/catalog.functions";
import { foodImage } from "@/lib/food-images";
import { guestRewardsQuery } from "@/lib/order-queries";
import { deliveryAddressSchema, placeOrder, type DeliveryAddress } from "@/lib/orders.functions";
import {
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  PROMOS,
  PricingError,
  REDEEM_STEP,
  computeTotals,
  formatMoney,
  type Totals,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Grill & Swill" },
      {
        name: "description",
        content:
          "Finish your Grill & Swill order for delivery or pickup. Guest checkout, no account needed.",
      },
      { property: "og:title", content: "Checkout | Grill & Swill" },
      { property: "og:description", content: "Guest checkout for delivery or pickup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const ADDRESS_KEY = "grill-swill-address-v1";
const CHECKOUT_REQUEST_KEY = "grill-swill-checkout-request-v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEPS = ["Where", "Details", "Pay"] as const;

const EMPTY_ADDRESS: DeliveryAddress = {
  name: "",
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  instructions: "",
};

function CheckoutPage() {
  const cart = useCart();
  const guestId = useGuestId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useQuery(storesQuery());
  const { data: rewards } = useQuery(guestRewardsQuery(guestId));
  const { data: checkoutConfiguration } = useQuery({
    queryKey: ["checkout-configuration"],
    queryFn: () => getCheckoutConfiguration(),
    staleTime: 60_000,
  });
  const requestId = useRef<string | null>(null);

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<
    Partial<Record<keyof DeliveryAddress, string>>
  >({});
  const [pickupName, setPickupName] = useState("");
  const [pickupError, setPickupError] = useState<string>();
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [cardErrors, setCardErrors] = useState<{ number?: string; exp?: string; cvc?: string }>({});
  const [placing, setPlacing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ADDRESS_KEY);
      if (saved) {
        const parsed = { ...EMPTY_ADDRESS, ...(JSON.parse(saved) as Partial<DeliveryAddress>) };
        setAddress(parsed);
        setPickupName(parsed.name);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!cart.storeId && stores[0]) cart.setStoreId(stores[0].id);
  }, [cart, stores]);

  const availablePoints = rewards?.points ?? 0;
  const pricedLines = useMemo(
    () =>
      cart.lines.map((line) => ({
        category: line.category,
        lineTotalCents: line.unitPriceCents * line.quantity,
      })),
    [cart.lines],
  );

  const { totals, promoError } = useMemo((): {
    totals: Totals | null;
    promoError: string | null;
  } => {
    if (pricedLines.length === 0) return { totals: null, promoError: null };
    const base = {
      lines: pricedLines,
      fulfillment: cart.fulfillment,
      pointsToRedeem: points,
      availablePoints,
      promotions: checkoutConfiguration?.promotions ?? PROMOS,
      deliveryFeeCents: checkoutConfiguration?.deliveryFeeCents ?? DELIVERY_FEE_CENTS,
      freeDeliveryThresholdCents:
        checkoutConfiguration?.freeDeliveryThresholdCents ?? FREE_DELIVERY_THRESHOLD_CENTS,
    };
    try {
      return { totals: computeTotals({ ...base, promoCode }), promoError: null };
    } catch (e) {
      const msg = e instanceof PricingError ? e.message : "Couldn't apply that";
      try {
        return {
          totals: computeTotals({ ...base, promoCode: null }),
          promoError: promoCode ? msg : null,
        };
      } catch {
        return {
          totals: computeTotals({ ...base, promoCode: null, pointsToRedeem: 0 }),
          promoError: msg,
        };
      }
    }
  }, [pricedLines, cart.fulfillment, points, availablePoints, promoCode, checkoutConfiguration]);

  if (cart.hydrated && cart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-muted">
          <ShoppingBag className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-6 text-3xl font-black uppercase">Your bag is empty</h1>
        <p className="mt-2 text-muted-foreground">
          Add something hot off the grill, then come back here to check out.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-6">
          <Link to="/menu">Browse the menu</Link>
        </Button>
      </div>
    );
  }

  const store = stores.find((s) => s.id === cart.storeId);
  const maxPoints = totals
    ? Math.min(
        availablePoints,
        Math.floor((totals.subtotalCents - totals.promoDiscountCents) / 100) * 100,
      )
    : 0;
  const maxRedeem = maxPoints - (maxPoints % REDEEM_STEP);

  function validateDetails(): boolean {
    if (cart.fulfillment === "pickup") {
      if (pickupName.trim().length < 2) {
        setPickupError("Add a name for pickup");
        return false;
      }
      setPickupError(undefined);
      return true;
    }
    const res = deliveryAddressSchema.safeParse(address);
    if (!res.success) {
      const errs: Partial<Record<keyof DeliveryAddress, string>> = {};
      for (const issue of res.error.issues)
        errs[issue.path[0] as keyof DeliveryAddress] ??= issue.message;
      setAddressErrors(errs);
      return false;
    }
    setAddressErrors({});
    setAddress(res.data);
    window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(res.data));
    return true;
  }

  function validateCard(): boolean {
    const digits = card.number.replace(/\D/g, "");
    const errs: typeof cardErrors = {};
    if (digits.length < 15 || digits.length > 16)
      errs.number = "Enter a 15 or 16 digit card number";
    const m = card.exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) errs.exp = "Use MM/YY";
    else {
      const expEnd = new Date(2000 + Number(m[2]), Number(m[1]), 1);
      if (expEnd <= new Date()) errs.exp = "This card has expired";
    }
    if (!/^\d{3,4}$/.test(card.cvc)) errs.cvc = "3 or 4 digits";
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit() {
    if (!validateCard() || !guestId || !cart.storeId) return;
    const savedRequestId = window.sessionStorage.getItem(CHECKOUT_REQUEST_KEY);
    const checkoutRequestId =
      requestId.current ??
      (savedRequestId && UUID_PATTERN.test(savedRequestId)
        ? savedRequestId
        : window.crypto.randomUUID());
    requestId.current = checkoutRequestId;
    window.sessionStorage.setItem(CHECKOUT_REQUEST_KEY, checkoutRequestId);
    setPlacing(true);
    setServerError(null);
    try {
      const res = await placeOrder({
        data: {
          guestId,
          requestId: checkoutRequestId,
          lines: cart.lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            selections: l.selections,
            removed: l.removed,
            note: l.note,
          })),
          fulfillment: cart.fulfillment,
          storeId: cart.storeId,
          address: cart.fulfillment === "delivery" ? address : null,
          pickupName: cart.fulfillment === "pickup" ? pickupName.trim() : undefined,
          promoCode: promoError ? null : promoCode,
          pointsToRedeem: totals?.pointsRedeemed ?? 0,
          paymentLast4: card.number.replace(/\D/g, "").slice(-4),
        },
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      if (cart.fulfillment === "pickup") {
        window.localStorage.setItem(
          ADDRESS_KEY,
          JSON.stringify({ ...address, name: pickupName.trim() }),
        );
      }
      cart.clear();
      await queryClient.invalidateQueries({ queryKey: ["guest-rewards"] });
      toast.success(`Order #${res.orderNumber} is in! +${res.pointsEarned} points`);
      requestId.current = null;
      window.sessionStorage.removeItem(CHECKOUT_REQUEST_KEY);
      navigate({
        to: "/orders/$id",
        params: { id: res.orderId },
        search: { token: res.accessToken },
      });
    } catch (e) {
      console.error(e);
      setServerError("We couldn't place your order. You weren't charged — please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6">
      <Link
        to="/menu"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-charcoal"
      >
        <ArrowLeft className="h-4 w-4" /> Keep shopping
      </Link>
      <h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">Checkout</h1>

      <ol className="mt-6 flex items-center gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm font-bold uppercase transition",
                i <= step ? "text-charcoal" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full font-display text-sm font-black transition",
                  i < step
                    ? "bg-success text-primary-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="block h-full bg-primary"
                  animate={{ width: i < step ? "100%" : "0%" }}
                />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <Panel title="How do you want it?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["delivery", "pickup"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={cart.fulfillment === f}
                        onClick={() => cart.setFulfillment(f)}
                        className={cn(
                          "flex items-center gap-4 rounded-2xl border-2 bg-card p-5 text-left transition active:scale-[0.98]",
                          cart.fulfillment === f
                            ? "border-primary shadow-chunky"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-primary">
                          {f === "delivery" ? (
                            <Bike className="h-6 w-6" />
                          ) : (
                            <StoreIcon className="h-6 w-6" />
                          )}
                        </span>
                        <span>
                          <span className="block font-display text-lg font-black uppercase">
                            {f}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {f === "delivery"
                              ? `~30 min · free over ${formatMoney(checkoutConfiguration?.freeDeliveryThresholdCents ?? FREE_DELIVERY_THRESHOLD_CENTS)}`
                              : "~15 min · always free"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <h3 className="mt-8 font-display text-sm font-black tracking-wider uppercase">
                    {cart.fulfillment === "delivery" ? "Delivering from" : "Pick up at"}
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {stores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={cart.storeId === s.id}
                        onClick={() => cart.setStoreId(s.id)}
                        className={cn(
                          "rounded-2xl border-2 bg-card p-4 text-left transition",
                          cart.storeId === s.id
                            ? "border-primary"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <span className="flex items-center gap-2 font-bold">
                          <MapPin className="h-4 w-4 text-primary" /> {s.name}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {s.address}, {s.city}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {s.hours}
                        </span>
                      </button>
                    ))}
                  </div>
                  <NextButton disabled={!cart.storeId} onClick={() => setStep(1)}>
                    Continue
                  </NextButton>
                </Panel>
              )}

              {step === 1 && (
                <Panel
                  title={
                    cart.fulfillment === "delivery"
                      ? "Where should we bring it?"
                      : "Who's picking up?"
                  }
                >
                  {cart.fulfillment === "delivery" ? (
                    <div className="grid gap-4 sm:grid-cols-6">
                      <AddrField
                        k="name"
                        label="Full name"
                        autoComplete="name"
                        className="sm:col-span-3"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="phone"
                        label="Phone"
                        type="tel"
                        autoComplete="tel"
                        className="sm:col-span-3"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="street"
                        label="Street address"
                        autoComplete="address-line1"
                        className="sm:col-span-4"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="unit"
                        label="Apt / unit"
                        autoComplete="address-line2"
                        className="sm:col-span-2"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="city"
                        label="City"
                        autoComplete="address-level2"
                        className="sm:col-span-3"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="state"
                        label="State"
                        autoComplete="address-level1"
                        maxLength={2}
                        placeholder="TX"
                        className="sm:col-span-1"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="zip"
                        label="ZIP"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        className="sm:col-span-2"
                        {...{ address, setAddress, addressErrors }}
                      />
                      <AddrField
                        k="instructions"
                        label="Delivery notes (optional)"
                        placeholder="Gate code, leave at door…"
                        className="sm:col-span-6"
                        {...{ address, setAddress, addressErrors }}
                      />
                    </div>
                  ) : (
                    <div className="max-w-sm">
                      <Field
                        label="Name for the order"
                        autoComplete="name"
                        value={pickupName}
                        onChange={(e) => setPickupName(e.target.value)}
                        error={pickupError}
                        hint="We'll call this name at the counter."
                      />
                      {store && (
                        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-card p-4 text-sm">
                          <StoreIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>
                            <b>{store.name}</b>
                            <br />
                            {store.address}, {store.city}, {store.state} · {store.phone}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <NextButton onClick={() => validateDetails() && setStep(2)}>
                    Continue to payment
                  </NextButton>
                </Panel>
              )}

              {step === 2 && (
                <Panel title="Payment">
                  <div className="rounded-2xl bg-card p-5">
                    <h3 className="flex items-center gap-2 font-display text-sm font-black tracking-wider uppercase">
                      <Tag className="h-4 w-4 text-primary" /> Promo code
                    </h3>
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPromoCode(promoInput.trim() ? promoInput.trim().toUpperCase() : null);
                      }}
                    >
                      <input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="e.g. SWILL5"
                        aria-label="Promo code"
                        className="h-11 flex-1 rounded-xl border-2 border-input bg-background px-4 font-semibold uppercase outline-none focus:border-primary"
                      />
                      <Button type="submit" variant="charcoal" className="h-11">
                        Apply
                      </Button>
                    </form>
                    {promoCode && !promoError && (
                      <p className="mt-2 flex items-center justify-between text-sm font-semibold text-success">
                        <span>
                          <Check className="mr-1 inline h-4 w-4" />
                          {promoCode} applied
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={() => {
                            setPromoCode(null);
                            setPromoInput("");
                          }}
                        >
                          Remove
                        </button>
                      </p>
                    )}
                    {promoError && (
                      <p className="mt-2 text-sm font-semibold text-destructive">{promoError}</p>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl bg-card p-5">
                    <h3 className="flex items-center gap-2 font-display text-sm font-black tracking-wider uppercase">
                      <Gift className="h-4 w-4 text-primary" /> Swill points
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have <b className="text-charcoal">{availablePoints}</b> points. 100 points
                      = $1 off.
                    </p>
                    {maxRedeem >= REDEEM_STEP ? (
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={maxRedeem}
                          step={REDEEM_STEP}
                          value={Math.min(points, maxRedeem)}
                          onChange={(e) => setPoints(Number(e.target.value))}
                          aria-label="Points to redeem"
                          className="flex-1 accent-primary"
                        />
                        <span className="w-28 text-right text-sm font-bold tabular-nums">
                          {Math.min(points, maxRedeem)} pts ·{" "}
                          {formatMoney(Math.min(points, maxRedeem))}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Earn 100 points to start redeeming.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl bg-card p-5">
                    <h3 className="flex items-center gap-2 font-display text-sm font-black tracking-wider uppercase">
                      <CreditCard className="h-4 w-4 text-primary" /> Card
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Payments are simulated — no card is charged. Try 4242 4242 4242 4242.
                    </p>
                    <div className="mt-3 grid grid-cols-6 gap-3">
                      <Field
                        label="Card number"
                        className="col-span-6"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="4242 4242 4242 4242"
                        value={card.number}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            number: e.target.value
                              .replace(/[^\d]/g, "")
                              .slice(0, 16)
                              .replace(/(\d{4})(?=\d)/g, "$1 "),
                          }))
                        }
                        error={cardErrors.number}
                      />
                      <Field
                        label="Expiry"
                        className="col-span-3"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM/YY"
                        value={card.exp}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setCard((c) => ({
                            ...c,
                            exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d,
                          }));
                        }}
                        error={cardErrors.exp}
                      />
                      <Field
                        label="CVC"
                        className="col-span-3"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                        value={card.cvc}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            cvc: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                        error={cardErrors.cvc}
                      />
                    </div>
                  </div>

                  {serverError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm font-semibold text-destructive"
                    >
                      {serverError}
                    </p>
                  )}
                  <Button
                    variant="hero"
                    size="xl"
                    className="mt-6 w-full"
                    onClick={submit}
                    loading={placing}
                    disabled={!guestId || !totals}
                  >
                    <Lock className="h-4 w-4" /> Place order{" "}
                    {totals ? `· ${formatMoney(totals.totalCents)}` : ""}
                  </Button>
                </Panel>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="h-fit rounded-3xl bg-card p-6 shadow-card lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-black uppercase">Your order</h2>
          <ul className="mt-4 space-y-3">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex gap-3">
                <img
                  src={foodImage(l.imageKey)}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {l.quantity} × {l.name}
                  </p>
                  {l.summary.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {l.summary.join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatMoney(l.unitPriceCents * l.quantity)}
                </span>
              </li>
            ))}
          </ul>
          {totals && (
            <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
              <Row label="Subtotal" value={formatMoney(totals.subtotalCents)} />
              {totals.promoDiscountCents > 0 && (
                <Row
                  label={`Promo ${totals.promoCode}`}
                  value={`−${formatMoney(totals.promoDiscountCents)}`}
                  accent
                />
              )}
              {totals.pointsDiscountCents > 0 && (
                <Row
                  label={`${totals.pointsRedeemed} points`}
                  value={`−${formatMoney(totals.pointsDiscountCents)}`}
                  accent
                />
              )}
              {cart.fulfillment === "delivery" && (
                <Row
                  label="Delivery"
                  value={
                    totals.deliveryFeeCents === 0 ? "Free" : formatMoney(totals.deliveryFeeCents)
                  }
                />
              )}
              <Row label="Tax (8.25%)" value={formatMoney(totals.taxCents)} />
              <div className="flex items-baseline justify-between border-t pt-3">
                <dt className="font-display font-black uppercase">Total</dt>
                <dd className="font-display text-2xl font-black tabular-nums">
                  {formatMoney(totals.totalCents)}
                </dd>
              </div>
              <p className="pt-1 text-xs font-semibold text-primary">
                You'll earn {totals.pointsEarned} points with this order
              </p>
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-black uppercase">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function NextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="hero"
      size="xl"
      className="mt-8 w-full sm:w-auto"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between", accent && "font-semibold text-success")}>
      <dt className={accent ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function AddrField({
  k,
  label,
  address,
  setAddress,
  addressErrors,
  ...props
}: {
  k: keyof DeliveryAddress;
  label: string;
  address: DeliveryAddress;
  setAddress: (fn: (a: DeliveryAddress) => DeliveryAddress) => void;
  addressErrors: Partial<Record<keyof DeliveryAddress, string>>;
} & Omit<ComponentProps<typeof Field>, "label">) {
  return (
    <Field
      label={label}
      value={address[k] ?? ""}
      onChange={(e) => setAddress((a) => ({ ...a, [k]: e.target.value }))}
      error={addressErrors[k]}
      {...props}
    />
  );
}
