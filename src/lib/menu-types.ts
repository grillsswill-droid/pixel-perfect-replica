export type CategoryId = "burgers" | "chicken" | "pizza" | "sides" | "drinks" | "kids" | "desserts";
export type QuickOrderGroup = "burgers" | "pizza" | "kids" | "desserts";
export type CurrencyCode = "USD";

export interface BundleComponent {
  label: string;
  quantity: number;
  menu_item_id?: string;
}

export interface BundleComponentSnapshot {
  label: string;
  quantity: number;
}

export const CATEGORIES: { id: CategoryId; label: string; short: string; blurb: string }[] = [
  {
    id: "burgers",
    label: "Burgers & Combos",
    short: "Burgers",
    blurb: "Smashed to order on a 500° flat-top.",
  },
  {
    id: "chicken",
    label: "Crispy Chicken",
    short: "Chicken",
    blurb: "Buttermilk-brined, hand-breaded daily.",
  },
  {
    id: "pizza",
    label: "Fresh Pizzas",
    short: "Pizza",
    blurb: "48-hour dough, blistered in a wood oven.",
  },
  { id: "sides", label: "Fries & Sides", short: "Sides", blurb: "Cut in-house. Never frozen." },
  {
    id: "drinks",
    label: "Coffee & Drinks",
    short: "Drinks",
    blurb: "18-hour cold brew & hand-spun shakes.",
  },
  {
    id: "kids",
    label: "Little Swillers",
    short: "Kids' Meals",
    blurb: "Little portions made for hungry young guests.",
  },
  {
    id: "desserts",
    label: "Ice Cream & Desserts",
    short: "Desserts",
    blurb: "A sweet finish to your Grill & Swill meal.",
  },
];

export interface MenuCategory {
  id: CategoryId;
  label: string;
  short: string;
  blurb: string;
  sort_order: number;
}

export interface OptionChoice {
  id: string;
  label: string;
  price_cents: number;
  menu_item_id?: string;
  bundle_quantity?: number;
  is_available?: boolean;
}

export interface OptionGroup {
  id: string;
  label: string;
  type: "single" | "multi";
  required?: boolean;
  source_item_group_id?: string;
  source_option_group_id?: string;
  choices: OptionChoice[];
}

type OptionChoiceInput = Omit<OptionChoice, "menu_item_id" | "bundle_quantity" | "is_available"> & {
  menu_item_id?: string | undefined;
  bundle_quantity?: number | undefined;
  is_available?: boolean | undefined;
};

type OptionGroupInput = Omit<
  OptionGroup,
  "required" | "source_item_group_id" | "source_option_group_id" | "choices"
> & {
  required?: boolean | undefined;
  source_item_group_id?: string | undefined;
  source_option_group_id?: string | undefined;
  choices: readonly OptionChoiceInput[];
};

/** Removes explicit undefined values so exact optional types serialize consistently. */
export function normalizeOptionGroups(groups: readonly OptionGroupInput[]): OptionGroup[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    type: group.type,
    ...(group.required !== undefined ? { required: group.required } : {}),
    ...(group.source_item_group_id ? { source_item_group_id: group.source_item_group_id } : {}),
    ...(group.source_option_group_id
      ? { source_option_group_id: group.source_option_group_id }
      : {}),
    choices: group.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      price_cents: choice.price_cents,
      ...(choice.menu_item_id ? { menu_item_id: choice.menu_item_id } : {}),
      ...(choice.bundle_quantity !== undefined ? { bundle_quantity: choice.bundle_quantity } : {}),
      ...(choice.is_available !== undefined ? { is_available: choice.is_available } : {}),
    })),
  }));
}

export interface MenuItem {
  id: string;
  slug: string;
  category: CategoryId;
  name: string;
  description: string;
  price_cents: number;
  calories: number;
  image_key: string;
  tags: string[];
  ingredients: string[];
  options: OptionGroup[];
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  currency?: CurrencyCode;
  is_quick_order?: boolean;
  quick_order_group?: QuickOrderGroup;
  quick_order_order?: number;
  bundle_components?: BundleComponent[];
}

export function normalizeBundleComponents(
  components: readonly (Omit<BundleComponent, "menu_item_id"> & {
    menu_item_id?: string | undefined;
  })[],
): BundleComponent[] {
  return components.map((component) => ({
    label: component.label,
    quantity: component.quantity,
    ...(component.menu_item_id ? { menu_item_id: component.menu_item_id } : {}),
  }));
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  lat: number;
  lng: number;
  hours: string;
  features: string[];
}

/** Selections keyed by option group id → chosen choice ids. */
export type Selections = Record<string, string[]>;

export interface CartLine {
  key: string;
  itemId: string;
  slug: string;
  category: CategoryId;
  name: string;
  imageKey: string;
  quantity: number;
  selections: Selections;
  removed: string[];
  note: string;
  /** Display-only snapshot; the server recomputes every price. */
  unitPriceCents: number;
  summary: string[];
  bundleComponents?: BundleComponentSnapshot[];
}

export type Fulfillment = "delivery" | "pickup";

export interface OrderLineSnapshot {
  itemId: string;
  slug?: string;
  name: string;
  imageKey: string;
  quantity: number;
  unitPriceCents: number;
  summary: string[];
  selections: Selections;
  removed: string[];
  note: string;
  bundleComponents?: BundleComponentSnapshot[];
}
