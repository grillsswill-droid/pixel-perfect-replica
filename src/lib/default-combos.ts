/**
 * Bundled copy of the signature combo menu from scripts/seed-combo-meals.mjs.
 * Used only when the menu database is unreachable, so prices and contents must
 * stay identical to the seed data.
 */
import type { MenuItem, OptionGroup } from "./menu-types";

type ComboSeed = Omit<
  MenuItem,
  "calories" | "tags" | "ingredients" | "options" | "is_available" | "currency" | "is_quick_order"
>;

const comboSeeds: ComboSeed[] = [
  {
    id: "d3787288-4354-5f6d-a100-8785fc49936e",
    slug: "swillhouse-classic-meal",
    name: "Swillhouse Classic Meal",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1299,
    description: "A signature beef burger with regular fries and a regular soft drink.",
    image_key: "combo_swillhouse_classic",
    bundle_components: [
      {
        quantity: 1,
        label: "Signature beef burger with cheese, lettuce, tomato, pickles and house sauce",
      },
      {
        quantity: 1,
        label: "Regular fries",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: true,
    sort_order: 0,
    quick_order_order: 1,
  },
  {
    id: "511592a9-9767-5907-a1e9-5e518e766510",
    slug: "double-stack-smokehouse",
    name: "Double Stack Smokehouse",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1549,
    description:
      "A double beef burger with double cheese, smoky BBQ sauce and caramelized onions, plus fries and a drink.",
    image_key: "combo_double_stack_smokehouse",
    bundle_components: [
      {
        quantity: 1,
        label: "Double beef burger with double cheese, smoky BBQ sauce and caramelized onions",
      },
      {
        quantity: 1,
        label: "Regular fries",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: true,
    sort_order: 1,
    quick_order_order: 2,
  },
  {
    id: "f96ff3cf-9613-5a9d-b0ab-560ea7b98691",
    slug: "firecracker-chicken-meal",
    name: "Firecracker Chicken Meal",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1399,
    description:
      "Crispy spicy chicken with lettuce and pepper mayonnaise, served with fries and a drink.",
    image_key: "combo_firecracker_chicken",
    bundle_components: [
      {
        quantity: 1,
        label: "Crispy spicy chicken fillet with lettuce and pepper mayonnaise",
      },
      {
        quantity: 1,
        label: "Regular fries",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: false,
    sort_order: 2,
    quick_order_order: 3,
  },
  {
    id: "9da1adc0-a95c-58f8-bed9-2ff5bea248e7",
    slug: "sticky-bbq-wings-box",
    name: "Sticky BBQ Wings Box",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1499,
    description: "Eight BBQ-glazed chicken wings with fries, dipping sauce and a drink.",
    image_key: "combo_sticky_bbq_wings",
    bundle_components: [
      {
        quantity: 8,
        label: "BBQ-glazed chicken wings",
      },
      {
        quantity: 1,
        label: "Regular fries",
      },
      {
        quantity: 1,
        label: "Dipping sauce",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: false,
    sort_order: 3,
    quick_order_order: 4,
  },
  {
    id: "2c7f3212-8e36-5aba-b657-1d511797aaf8",
    slug: "flame-grilled-chicken-meal",
    name: "Flame Grilled Chicken Meal",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1699,
    description: "A grilled chicken portion with regular fries, coleslaw and a drink.",
    image_key: "combo_flame_grilled_chicken",
    bundle_components: [
      {
        quantity: 1,
        label: "Grilled chicken portion",
      },
      {
        quantity: 1,
        label: "Regular fries",
      },
      {
        quantity: 1,
        label: "Coleslaw",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: false,
    sort_order: 4,
    quick_order_order: 5,
  },
  {
    id: "9c70b0ff-abd8-57fd-8e5f-3dff69b26837",
    slug: "swill-crunch-combo",
    name: "The Swill Crunch Combo",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1449,
    description: "A crispy chicken burger with loaded fries and a regular soft drink.",
    image_key: "combo_swill_crunch",
    bundle_components: [
      {
        quantity: 1,
        label: "Crispy chicken burger",
      },
      {
        quantity: 1,
        label: "Loaded fries",
      },
      {
        quantity: 1,
        label: "Regular soft drink",
      },
    ],
    is_featured: false,
    sort_order: 5,
    quick_order_order: 6,
  },
  {
    id: "f21f14d3-e731-5bca-9154-70295dde0aad",
    slug: "solo-pizza-box",
    name: "Solo Pizza Box",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 1299,
    description: "A personal pizza in your choice of available variety, with a soft drink.",
    image_key: "combo_solo_pizza_box",
    bundle_components: [
      {
        quantity: 1,
        label: "12-inch personal pizza",
      },
      {
        quantity: 1,
        label: "Soft drink",
      },
    ],
    is_featured: true,
    sort_order: 0,
    quick_order_order: 3,
  },
  {
    id: "acc844cb-aa02-5397-9924-3da28c8e6ffd",
    slug: "pizza-for-two",
    name: "Pizza For Two",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 2499,
    description: "A 16-inch share-size pizza of your choice, garlic bread and two soft drinks.",
    image_key: "combo_pizza_for_two",
    bundle_components: [
      {
        quantity: 1,
        label: "16-inch share-size pizza",
      },
      {
        quantity: 1,
        label: "Garlic bread",
      },
      {
        quantity: 2,
        label: "Soft drink",
      },
    ],
    is_featured: true,
    sort_order: 1,
    quick_order_order: 4,
  },
  {
    id: "7b6cbe10-9622-5c95-b467-010b892b2e1a",
    slug: "swill-pizza-feast",
    name: "Swill Pizza Feast",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 3499,
    description:
      "A 16-inch share-size pizza of your choice, six chicken wings and two soft drinks.",
    image_key: "combo_swill_pizza_feast",
    bundle_components: [
      {
        quantity: 1,
        label: "16-inch share-size pizza",
      },
      {
        quantity: 6,
        label: "Chicken wings",
      },
      {
        quantity: 2,
        label: "Soft drink",
      },
    ],
    is_featured: false,
    sort_order: 2,
    quick_order_order: 9,
  },
  {
    id: "9141fc3c-1de1-5029-be62-7d8bce9c35b0",
    slug: "pizza-wings-night",
    name: "Pizza & Wings Night",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 3299,
    description: "A 16-inch share-size pizza of your choice, eight chicken wings and garlic bread.",
    image_key: "combo_pizza_wings_night",
    bundle_components: [
      {
        quantity: 1,
        label: "16-inch share-size pizza",
      },
      {
        quantity: 8,
        label: "Chicken wings",
      },
      {
        quantity: 1,
        label: "Garlic bread",
      },
    ],
    is_featured: false,
    sort_order: 3,
    quick_order_order: 10,
  },
  {
    id: "8aa1e1c0-4cb8-5f1c-91ee-466465ead58a",
    slug: "little-swill-burger-box",
    name: "Little Swill Burger Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 799,
    description: "A mini cheeseburger with small fries and a kids' drink.",
    image_key: "kids_little_swill_burger_box",
    bundle_components: [
      {
        quantity: 1,
        label: "Mini cheeseburger",
      },
      {
        quantity: 1,
        label: "Small fries",
      },
      {
        quantity: 1,
        label: "Kids' drink",
      },
    ],
    is_featured: true,
    sort_order: 0,
    quick_order_order: 5,
  },
  {
    id: "5a6c8713-66ee-5b76-80ac-4fb8b049bd5d",
    slug: "mini-pizza-pals",
    name: "Mini Pizza Pals",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 849,
    description: "A personal mini pizza with a kids' drink.",
    image_key: "kids_mini_pizza_pals",
    bundle_components: [
      {
        quantity: 1,
        label: "Personal mini pizza",
      },
      {
        quantity: 1,
        label: "Kids' drink",
      },
    ],
    is_featured: false,
    sort_order: 1,
    quick_order_order: 12,
  },
  {
    id: "476143b0-224c-5622-ae85-dfbcf3177819",
    slug: "chicken-dippers-box",
    name: "Chicken Dippers Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 799,
    description: "Four chicken dippers with small fries and a kids' drink.",
    image_key: "kids_chicken_dippers_box",
    bundle_components: [
      {
        quantity: 4,
        label: "Chicken dippers",
      },
      {
        quantity: 1,
        label: "Small fries",
      },
      {
        quantity: 1,
        label: "Kids' drink",
      },
    ],
    is_featured: false,
    sort_order: 2,
    quick_order_order: 13,
  },
  {
    id: "7110330d-c55a-5d61-9da8-5620aeec2c4b",
    slug: "little-grillers-box",
    name: "Little Grillers Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 849,
    description: "Grilled chicken bites with small fries and a kids' drink.",
    image_key: "kids_little_grillers_box",
    bundle_components: [
      {
        quantity: 1,
        label: "Grilled chicken bites",
      },
      {
        quantity: 1,
        label: "Small fries",
      },
      {
        quantity: 1,
        label: "Kids' drink",
      },
    ],
    is_featured: false,
    sort_order: 3,
    quick_order_order: 14,
  },
  {
    id: "771cb438-23d6-53ac-998e-3e49f8dea296",
    slug: "swill-scoop-cup",
    name: "Swill Scoop Cup",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 349,
    description: "One scoop of the available ice cream.",
    image_key: "dessert_swill_scoop_cup",
    bundle_components: [
      {
        quantity: 1,
        label: "Scoop of available ice cream",
      },
    ],
    is_featured: true,
    sort_order: 0,
    quick_order_order: 6,
  },
  {
    id: "181864b5-4ba6-5268-9edc-2f02bdeeac8d",
    slug: "double-scoop-dream",
    name: "Double Scoop Dream",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 499,
    description: "Two scoops of the available ice cream.",
    image_key: "dessert_double_scoop_dream",
    bundle_components: [
      {
        quantity: 2,
        label: "Scoop of available ice cream",
      },
    ],
    is_featured: false,
    sort_order: 1,
    quick_order_order: 16,
  },
  {
    id: "06ec9f78-442f-5b08-aac0-330a9c377a6b",
    slug: "cookie-crunch-sundae",
    name: "Cookie Crunch Sundae",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 599,
    description: "Ice cream topped with cookie crumbs and chocolate sauce.",
    image_key: "dessert_cookie_crunch_sundae",
    bundle_components: [
      {
        quantity: 1,
        label: "Scoop of available ice cream",
      },
      {
        quantity: 1,
        label: "Cookie crumbs",
      },
      {
        quantity: 1,
        label: "Chocolate sauce",
      },
    ],
    is_featured: false,
    sort_order: 2,
    quick_order_order: 17,
  },
  {
    id: "bf0dc3e0-e07e-58ec-8e6c-cf5323df1699",
    slug: "brownie-blast-sundae",
    name: "Brownie Blast Sundae",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 649,
    description: "Ice cream with brownie pieces and chocolate fudge.",
    image_key: "dessert_brownie_blast_sundae",
    bundle_components: [
      {
        quantity: 1,
        label: "Scoop of available ice cream",
      },
      {
        quantity: 1,
        label: "Brownie pieces",
      },
      {
        quantity: 1,
        label: "Chocolate fudge",
      },
    ],
    is_featured: false,
    sort_order: 3,
    quick_order_order: 18,
  },
];

export function buildDefaultCombos(menu: MenuItem[]): MenuItem[] {
  const pizzas = menu.filter(
    (item) =>
      item.category === "pizza" &&
      ["size", "crust", "toppings"].every((groupId) =>
        item.options.some((group) => group.id === groupId && group.choices.length),
      ),
  );
  const first = pizzas[0];
  const pizzaOptions: OptionGroup[] = first
    ? [
        {
          id: "pizza-variety",
          label: "Pizza variety",
          type: "single",
          required: true,
          choices: pizzas.map((pizza, index) => ({
            id: `variety-${index + 1}`,
            label: pizza.name,
            price_cents: 0,
            menu_item_id: pizza.id,
          })),
        },
        {
          id: "pizza-crust",
          label: "Crust",
          type: "single",
          required: true,
          source_item_group_id: "pizza-variety",
          source_option_group_id: "crust",
          choices: first.options.find((group) => group.id === "crust")?.choices ?? [],
        },
        {
          id: "pizza-toppings",
          label: "Extra toppings",
          type: "multi",
          source_item_group_id: "pizza-variety",
          source_option_group_id: "toppings",
          choices: first.options.find((group) => group.id === "toppings")?.choices ?? [],
        },
      ]
    : [];

  return comboSeeds.map((combo) => ({
    ...combo,
    calories: 0,
    tags: ["Combo"],
    ingredients: [],
    options: combo.category === "pizza" ? pizzaOptions : [],
    is_available: combo.category === "pizza" ? Boolean(first) : true,
    currency: "USD",
    is_quick_order: true,
  }));
}
