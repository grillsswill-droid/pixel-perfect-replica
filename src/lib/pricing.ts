import type { BundleComponentSnapshot, CategoryId, MenuItem, Selections } from "./menu-types";

export const TAX_RATE = 0.0825;
export const DELIVERY_FEE_CENTS = 399;
export const FREE_DELIVERY_THRESHOLD_CENTS = 3500;
export const POINTS_PER_DOLLAR = 10;
/** 100 points = $1.00 off. */
export const POINTS_PER_DOLLAR_REDEEMED = 100;
export const REDEEM_STEP = 100;

export interface RewardTier {
  points: number;
  label: string;
  value: string;
}

export const DEFAULT_REWARD_TIERS: RewardTier[] = [
  { points: 250, label: "Hand-Cut Fries or Lemonade", value: "$2.50 off" },
  { points: 500, label: "Any Coffee or Shake", value: "$5 off" },
  { points: 900, label: "Any Burger or Sandwich", value: "$9 off" },
  { points: 1500, label: 'Any 16" Pizza', value: "$15 off" },
];

export function getRewardTiers(value?: RewardTier[] | null): RewardTier[] {
  return Array.isArray(value) && value.length > 0 ? value : DEFAULT_REWARD_TIERS;
}

export function getPointsPerDollar(value?: number | null): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : POINTS_PER_DOLLAR;
}

export function getPointsPerDollarRedeemed(value?: number | null): number {
  return Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : POINTS_PER_DOLLAR_REDEEMED;
}

export interface PromoDefinition {
  code: string;
  label: string;
  description: string;
  kind: "amount" | "percent";
  value: number;
  minSubtotalCents?: number;
  category?: CategoryId;
}

export const PROMOS: PromoDefinition[] = [
  {
    code: "SWILL5",
    label: "$5 off $35+",
    description: "Take $5 off any order of $35 or more.",
    kind: "amount",
    value: 500,
    minSubtotalCents: 3500,
  },
  {
    code: "PIZZANIGHT",
    label: "20% off pizzas",
    description: "20% off every pizza in your bag.",
    kind: "percent",
    value: 20,
    category: "pizza",
  },
  {
    code: "FIRSTBITE",
    label: "15% off",
    description: "15% off your whole order.",
    kind: "percent",
    value: 15,
  },
];

export class PricingError extends Error {}

export function withMenuBundleAvailability(items: MenuItem[]): MenuItem[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return items.map((item) => {
    const options = item.options.map((group) => {
      const sourceChoices = group.source_item_group_id
        ? (item.options.find((source) => source.id === group.source_item_group_id)?.choices ?? [])
            .map((choice) => (choice.menu_item_id ? itemsById.get(choice.menu_item_id) : undefined))
            .filter((source): source is MenuItem => Boolean(source?.is_available))
        : [];
      return {
        ...group,
        choices: group.choices.map((choice) => {
          if (choice.menu_item_id) {
            return {
              ...choice,
              is_available: itemsById.get(choice.menu_item_id)?.is_available ?? false,
            };
          }
          if (group.source_option_group_id) {
            const supported = sourceChoices.some((source) =>
              source.options
                .find((sourceGroup) => sourceGroup.id === group.source_option_group_id)
                ?.choices.some(
                  (sourceChoice) =>
                    sourceChoice.id === choice.id &&
                    sourceChoice.price_cents === choice.price_cents,
                ),
            );
            return { ...choice, is_available: supported };
          }
          return choice;
        }),
      };
    });
    const requiredChoicesUnavailable = options.some(
      (group) =>
        group.required &&
        group.choices.length > 0 &&
        group.choices.every((choice) => choice.is_available === false),
    );
    const linkedComponentUnavailable = (item.bundle_components ?? []).some(
      (component) => component.menu_item_id && !itemsById.get(component.menu_item_id)?.is_available,
    );
    return {
      ...item,
      options,
      is_available: item.is_available && !requiredChoicesUnavailable && !linkedComponentUnavailable,
    };
  });
}

export function validateMenuBundle(
  item: MenuItem,
  selections: Selections,
  itemsById: ReadonlyMap<string, MenuItem>,
): void {
  for (const component of item.bundle_components ?? []) {
    if (!component.menu_item_id) continue;
    const linkedItem = itemsById.get(component.menu_item_id);
    if (!linkedItem?.is_available) {
      throw new PricingError(
        `${component.label} is unavailable, so ${item.name} can't be ordered.`,
      );
    }
  }

  for (const group of item.options) {
    for (const choiceId of selections[group.id] ?? []) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      if (!choice?.menu_item_id) continue;
      const linkedItem = itemsById.get(choice.menu_item_id);
      if (!linkedItem?.is_available) {
        throw new PricingError(`${choice.label} is sold out right now.`);
      }
    }

    if (!group.source_item_group_id || !group.source_option_group_id) continue;
    const sourceGroup = item.options.find((entry) => entry.id === group.source_item_group_id);
    const sourceChoiceId = selections[group.source_item_group_id]?.[0];
    const sourceChoice = sourceGroup?.choices.find((entry) => entry.id === sourceChoiceId);
    const sourceItem = sourceChoice?.menu_item_id
      ? itemsById.get(sourceChoice.menu_item_id)
      : undefined;
    const sourceOptions = sourceItem?.options.find(
      (entry) => entry.id === group.source_option_group_id,
    );
    if (!sourceItem?.is_available || !sourceOptions) {
      throw new PricingError(`Choose an available ${sourceGroup?.label ?? "menu item"}.`);
    }
    for (const choiceId of selections[group.id] ?? []) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      const sourceOption = sourceOptions.choices.find((entry) => entry.id === choiceId);
      if (!choice || !sourceOption || sourceOption.price_cents !== choice.price_cents) {
        throw new PricingError(
          `${choice?.label ?? "That option"} isn't available for ${sourceItem.name}.`,
        );
      }
    }
  }
}

/** Unit price for a menu item with the given option selections. Validates the selections. */
export function unitPriceCents(
  item: Pick<MenuItem, "price_cents" | "options">,
  selections: Selections,
): number {
  let total = item.price_cents;
  for (const group of item.options) {
    const chosen = selections[group.id] ?? [];
    if (group.type === "single" && chosen.length > 1) {
      throw new PricingError(`Pick only one option for ${group.label}`);
    }
    if (group.required && chosen.length === 0) {
      throw new PricingError(`Choose an option for ${group.label}`);
    }
    for (const choiceId of chosen) {
      const choice = group.choices.find((c) => c.id === choiceId);
      if (!choice) throw new PricingError(`Unknown option for ${group.label}`);
      if (choice.is_available === false)
        throw new PricingError(`${choice.label} is sold out right now.`);
      total += choice.price_cents;
    }
  }
  for (const key of Object.keys(selections)) {
    if (!item.options.some((g) => g.id === key)) throw new PricingError("Unknown option group");
  }
  return total;
}

/** Default selections: first choice of every required single-choice group. */
export function defaultSelections(item: Pick<MenuItem, "options">): Selections {
  const s: Selections = {};
  for (const g of item.options) {
    s[g.id] =
      g.type === "single" && g.required
        ? [g.choices.find((choice) => choice.is_available !== false)?.id].filter(
            (id): id is string => Boolean(id),
          )
        : [];
  }
  return s;
}

export function selectionSummary(
  item: Pick<MenuItem, "options">,
  selections: Selections,
  removed: string[],
): string[] {
  const parts: string[] = [];
  for (const g of item.options) {
    for (const id of selections[g.id] ?? []) {
      const c = g.choices.find((x) => x.id === id);
      if (!c) continue;
      if (c.menu_item_id) continue;
      // Skip "nothing extra" defaults like "Just the burger".
      if (c.price_cents === 0 && (id === "none" || g.choices[0]?.id === id) && g.type === "single")
        continue;
      parts.push(c.label);
    }
  }
  for (const r of removed) parts.push(`No ${r.toLowerCase()}`);
  return parts;
}

export function bundleComponentsFor(
  item: Pick<MenuItem, "options" | "bundle_components">,
  selections: Selections,
): BundleComponentSnapshot[] {
  const components = (item.bundle_components ?? []).map(({ label, quantity }) => ({
    label,
    quantity,
  }));
  for (const group of item.options) {
    for (const choiceId of selections[group.id] ?? []) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      if (!choice?.menu_item_id) continue;
      components.push({
        label: choice.label,
        quantity: choice.bundle_quantity ?? 1,
      });
    }
  }
  return components;
}

export function findPromo(
  code: string | null | undefined,
  promotions: PromoDefinition[] = PROMOS,
): PromoDefinition | undefined {
  if (!code) return undefined;
  const norm = code.trim().toUpperCase();
  return promotions.find((p) => p.code === norm);
}

export interface PricedLine {
  category: CategoryId;
  lineTotalCents: number;
}

/** Returns discount in cents, or throws PricingError when the promo can't apply. */
export function promoDiscountCents(promo: PromoDefinition, lines: PricedLine[]): number {
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (promo.minSubtotalCents && subtotal < promo.minSubtotalCents) {
    throw new PricingError(
      `${promo.code} needs a subtotal of at least $${(promo.minSubtotalCents / 100).toFixed(2)}`,
    );
  }
  const base = promo.category
    ? lines.filter((l) => l.category === promo.category).reduce((s, l) => s + l.lineTotalCents, 0)
    : subtotal;
  if (base === 0) throw new PricingError(`${promo.code} doesn't apply to anything in your bag`);
  const raw = promo.kind === "amount" ? promo.value : Math.round((base * promo.value) / 100);
  return Math.min(raw, base);
}

export interface TotalsInput {
  lines: PricedLine[];
  fulfillment: "delivery" | "pickup";
  promoCode?: string | null | undefined;
  pointsToRedeem?: number | undefined;
  availablePoints?: number | undefined;
  promotions?: PromoDefinition[] | undefined;
  deliveryFeeCents?: number | undefined;
  freeDeliveryThresholdCents?: number | undefined;
  pointsPerDollar?: number | undefined;
  pointsPerDollarRedeemed?: number | undefined;
}

export interface Totals {
  subtotalCents: number;
  promoDiscountCents: number;
  pointsDiscountCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  pointsRedeemed: number;
  pointsEarned: number;
  promoCode: string | null;
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotalCents = input.lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (subtotalCents <= 0) throw new PricingError("Your bag is empty");

  const pointsPerDollar = getPointsPerDollar(input.pointsPerDollar);
  const pointsPerDollarRedeemed = getPointsPerDollarRedeemed(input.pointsPerDollarRedeemed);

  const promo = input.promoCode
    ? findPromo(input.promoCode, input.promotions ?? PROMOS)
    : undefined;
  if (input.promoCode && input.promoCode.trim() && !promo)
    throw new PricingError("That promo code isn't valid");
  const promoDiscount = promo ? promoDiscountCents(promo, input.lines) : 0;

  const requested = Math.max(0, Math.floor(input.pointsToRedeem ?? 0));
  if (requested % REDEEM_STEP !== 0)
    throw new PricingError(`Points redeem in blocks of ${REDEEM_STEP}`);
  if (requested > (input.availablePoints ?? 0))
    throw new PricingError("You don't have that many points");
  const afterPromo = subtotalCents - promoDiscount;
  const maxRedeemable = Math.floor(afterPromo / 100) * pointsPerDollarRedeemed;
  const pointsRedeemed = Math.min(requested, maxRedeemable - (maxRedeemable % REDEEM_STEP));
  const pointsDiscount = Math.round((pointsRedeemed / pointsPerDollarRedeemed) * 100);

  const discountCents = promoDiscount + pointsDiscount;
  const taxable = subtotalCents - discountCents;
  const deliveryFeeCents =
    input.fulfillment === "delivery" &&
    subtotalCents < (input.freeDeliveryThresholdCents ?? FREE_DELIVERY_THRESHOLD_CENTS)
      ? (input.deliveryFeeCents ?? DELIVERY_FEE_CENTS)
      : 0;
  const taxCents = Math.round(taxable * TAX_RATE);
  const totalCents = taxable + taxCents + deliveryFeeCents;
  const pointsEarned = Math.floor(taxable / 100) * pointsPerDollar;

  return {
    subtotalCents,
    promoDiscountCents: promoDiscount,
    pointsDiscountCents: pointsDiscount,
    discountCents,
    deliveryFeeCents,
    taxCents,
    totalCents,
    pointsRedeemed,
    pointsEarned,
    promoCode: promo?.code ?? null,
  };
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const REWARD_TIERS = DEFAULT_REWARD_TIERS;

export const MEMBER_LEVELS = [
  { name: "Spark", min: 0 },
  { name: "Flame", min: 1000 },
  { name: "Inferno", min: 3000 },
];

export function memberLevel(lifetimePoints: number) {
  let current = MEMBER_LEVELS[0]!;
  let next: (typeof MEMBER_LEVELS)[number] | null = null;
  for (let i = 0; i < MEMBER_LEVELS.length; i++) {
    if (lifetimePoints >= MEMBER_LEVELS[i]!.min) {
      current = MEMBER_LEVELS[i]!;
      next = MEMBER_LEVELS[i + 1] ?? null;
    }
  }
  return { current, next };
}
