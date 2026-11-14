export type CategoryId = "burgers" | "chicken" | "pizza" | "sides" | "drinks";

export const CATEGORIES: { id: CategoryId; label: string; short: string; blurb: string }[] = [
  { id: "burgers", label: "Burgers & Combos", short: "Burgers", blurb: "Smashed to order on a 500° flat-top." },
  { id: "chicken", label: "Crispy Chicken", short: "Chicken", blurb: "Buttermilk-brined, hand-breaded daily." },
  { id: "pizza", label: "Fresh Pizzas", short: "Pizza", blurb: "48-hour dough, blistered in a wood oven." },
  { id: "sides", label: "Fries & Sides", short: "Sides", blurb: "Cut in-house. Never frozen." },
  { id: "drinks", label: "Coffee & Drinks", short: "Drinks", blurb: "18-hour cold brew & hand-spun shakes." },
];

export interface OptionChoice {
  id: string;
  label: string;
  price_cents: number;
}

export interface OptionGroup {
  id: string;
  label: string;
  type: "single" | "multi";
  required?: boolean;
  choices: OptionChoice[];
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
  name: string;
  imageKey: string;
  quantity: number;
  selections: Selections;
  removed: string[];
  note: string;
  /** Display-only snapshot; the server recomputes every price. */
  unitPriceCents: number;
  summary: string[];
}

export type Fulfillment = "delivery" | "pickup";

export interface OrderLineSnapshot {
  itemId: string;
  name: string;
  imageKey: string;
  quantity: number;
  unitPriceCents: number;
  summary: string[];
  selections: Selections;
  removed: string[];
  note: string;
}
