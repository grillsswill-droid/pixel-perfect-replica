import { describe, expect, it } from "vitest";

import type { MenuItem, Selections } from "@/lib/menu-types";
import {
  bundleComponentsFor,
  defaultSelections,
  PricingError,
  unitPriceCents,
  validateMenuBundle,
  withMenuBundleAvailability,
} from "@/lib/pricing";

const pizzaId = "00000000-0000-4000-8000-000000000001";
const comboId = "00000000-0000-4000-8000-000000000002";

const pizza: MenuItem = {
  id: pizzaId,
  slug: "pepperoni-blaze",
  category: "pizza",
  name: "Pepperoni Blaze",
  description: "",
  price_cents: 1399,
  calories: 0,
  image_key: "pizza",
  tags: [],
  ingredients: [],
  is_available: true,
  is_featured: false,
  sort_order: 1,
  options: [
    { id: "size", label: "Size", type: "single", required: true, choices: [] },
    {
      id: "crust",
      label: "Crust",
      type: "single",
      required: true,
      choices: [
        { id: "classic", label: "48-hour classic", price_cents: 0 },
        { id: "cauli", label: "Cauliflower", price_cents: 200 },
      ],
    },
    {
      id: "toppings",
      label: "Extra toppings",
      type: "multi",
      choices: [{ id: "pep", label: "Cup-and-char pepperoni", price_cents: 200 }],
    },
  ],
};

const combo: MenuItem = {
  id: comboId,
  slug: "solo-pizza-box",
  category: "pizza",
  name: "Solo Pizza Box",
  description: "",
  price_cents: 1299,
  calories: 0,
  image_key: "pizza",
  tags: ["Combo"],
  ingredients: [],
  is_available: true,
  is_featured: true,
  sort_order: 1,
  is_quick_order: true,
  quick_order_group: "pizza",
  currency: "USD",
  bundle_components: [{ label: "Soft drink", quantity: 1 }],
  options: [
    {
      id: "pizza-variety",
      label: "Pizza variety",
      type: "single",
      required: true,
      choices: [
        {
          id: "pepperoni",
          label: "Pepperoni Blaze",
          price_cents: 0,
          menu_item_id: pizzaId,
        },
      ],
    },
    {
      id: "pizza-crust",
      label: "Crust",
      type: "single",
      required: true,
      source_item_group_id: "pizza-variety",
      source_option_group_id: "crust",
      choices: [
        { id: "classic", label: "48-hour classic", price_cents: 0 },
        { id: "cauli", label: "Cauliflower", price_cents: 200 },
      ],
    },
    {
      id: "pizza-toppings",
      label: "Extra toppings",
      type: "multi",
      source_item_group_id: "pizza-variety",
      source_option_group_id: "toppings",
      choices: [{ id: "pep", label: "Cup-and-char pepperoni", price_cents: 200 }],
    },
  ],
};

const selections: Selections = {
  "pizza-variety": ["pepperoni"],
  "pizza-crust": ["classic"],
  "pizza-toppings": ["pep"],
};

describe("combo menu validation", () => {
  it("uses configured pizza options to price and snapshot a selected combo", () => {
    const items = new Map([
      [pizza.id, pizza],
      [combo.id, combo],
    ]);

    validateMenuBundle(combo, selections, items);
    expect(unitPriceCents(combo, selections)).toBe(1499);
    expect(bundleComponentsFor(combo, selections)).toEqual([
      { label: "Soft drink", quantity: 1 },
      { label: "Pepperoni Blaze", quantity: 1 },
    ]);
  });

  it("marks a combo unavailable when its linked variety is sold out", () => {
    const soldOutPizza = { ...pizza, is_available: false };
    const [availableCombo] = withMenuBundleAvailability([soldOutPizza, combo]).filter(
      (item) => item.id === combo.id,
    );

    expect(availableCombo?.is_available).toBe(false);
    expect(defaultSelections(availableCombo!)["pizza-variety"]).toEqual([]);
    expect(() =>
      validateMenuBundle(combo, selections, new Map([[pizza.id, soldOutPizza]])),
    ).toThrow(PricingError);
  });

  it("rejects toppings that are not configured on the selected pizza variety", () => {
    const invalidCombo = {
      ...combo,
      options: combo.options.map((group) =>
        group.id === "pizza-toppings"
          ? {
              ...group,
              choices: [...group.choices, { id: "mushroom", label: "Mushrooms", price_cents: 125 }],
            }
          : group,
      ),
    };

    expect(() =>
      validateMenuBundle(
        invalidCombo,
        { ...selections, "pizza-toppings": ["mushroom"] },
        new Map([[pizza.id, pizza]]),
      ),
    ).toThrow("isn't available for Pepperoni Blaze");
  });
});
