import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";

for (const path of [".env.local", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Set MONGODB_URI before running the combo-menu seed script.");
}

const namespace = "grill-and-swill:signature-combo-menu:v1:";

function stableId(value) {
  const hash = createHash("sha1").update(`${namespace}${value}`).digest("hex").slice(0, 32);
  const versioned = `${hash.slice(0, 12)}5${hash.slice(13)}`;
  const variant = ((Number.parseInt(versioned[16], 16) & 3) | 8).toString(16);
  const hex = `${versioned.slice(0, 16)}${variant}${versioned.slice(17)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const categoryRecords = [
  {
    id: "kids",
    label: "Little Swillers",
    short: "Kids' Meals",
    blurb: "Little portions made for hungry young guests.",
    sort_order: 6,
  },
  {
    id: "desserts",
    label: "Ice Cream & Desserts",
    short: "Desserts",
    blurb: "A sweet finish to your Grill & Swill meal.",
    sort_order: 7,
  },
];

const products = [
  {
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
      { quantity: 1, label: "Regular fries" },
      { quantity: 1, label: "Regular soft drink" },
    ],
    is_featured: true,
  },
  {
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
      { quantity: 1, label: "Regular fries" },
      { quantity: 1, label: "Regular soft drink" },
    ],
    is_featured: true,
  },
  {
    slug: "firecracker-chicken-meal",
    name: "Firecracker Chicken Meal",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1399,
    description:
      "Crispy spicy chicken with lettuce and pepper mayonnaise, served with fries and a drink.",
    image_key: "combo_firecracker_chicken",
    bundle_components: [
      { quantity: 1, label: "Crispy spicy chicken fillet with lettuce and pepper mayonnaise" },
      { quantity: 1, label: "Regular fries" },
      { quantity: 1, label: "Regular soft drink" },
    ],
  },
  {
    slug: "sticky-bbq-wings-box",
    name: "Sticky BBQ Wings Box",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1499,
    description: "Eight BBQ-glazed chicken wings with fries, dipping sauce and a drink.",
    image_key: "combo_sticky_bbq_wings",
    bundle_components: [
      { quantity: 8, label: "BBQ-glazed chicken wings" },
      { quantity: 1, label: "Regular fries" },
      { quantity: 1, label: "Dipping sauce" },
      { quantity: 1, label: "Regular soft drink" },
    ],
  },
  {
    slug: "flame-grilled-chicken-meal",
    name: "Flame Grilled Chicken Meal",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1699,
    description: "A grilled chicken portion with regular fries, coleslaw and a drink.",
    image_key: "combo_flame_grilled_chicken",
    bundle_components: [
      { quantity: 1, label: "Grilled chicken portion" },
      { quantity: 1, label: "Regular fries" },
      { quantity: 1, label: "Coleslaw" },
      { quantity: 1, label: "Regular soft drink" },
    ],
  },
  {
    slug: "swill-crunch-combo",
    name: "The Swill Crunch Combo",
    category: "burgers",
    quick_order_group: "burgers",
    price_cents: 1449,
    description: "A crispy chicken burger with loaded fries and a regular soft drink.",
    image_key: "combo_swill_crunch",
    bundle_components: [
      { quantity: 1, label: "Crispy chicken burger" },
      { quantity: 1, label: "Loaded fries" },
      { quantity: 1, label: "Regular soft drink" },
    ],
  },
  {
    slug: "solo-pizza-box",
    name: "Solo Pizza Box",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 1299,
    description: "A personal pizza in your choice of available variety, with a soft drink.",
    image_key: "combo_solo_pizza_box",
    bundle_components: [
      { quantity: 1, label: "12-inch personal pizza" },
      { quantity: 1, label: "Soft drink" },
    ],
    is_featured: true,
  },
  {
    slug: "pizza-for-two",
    name: "Pizza For Two",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 2499,
    description: "A 16-inch share-size pizza of your choice, garlic bread and two soft drinks.",
    image_key: "combo_pizza_for_two",
    bundle_components: [
      { quantity: 1, label: "16-inch share-size pizza" },
      { quantity: 1, label: "Garlic bread" },
      { quantity: 2, label: "Soft drink" },
    ],
    is_featured: true,
  },
  {
    slug: "swill-pizza-feast",
    name: "Swill Pizza Feast",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 3499,
    description:
      "A 16-inch share-size pizza of your choice, six chicken wings and two soft drinks.",
    image_key: "combo_swill_pizza_feast",
    bundle_components: [
      { quantity: 1, label: "16-inch share-size pizza" },
      { quantity: 6, label: "Chicken wings" },
      { quantity: 2, label: "Soft drink" },
    ],
  },
  {
    slug: "pizza-wings-night",
    name: "Pizza & Wings Night",
    category: "pizza",
    quick_order_group: "pizza",
    price_cents: 3299,
    description: "A 16-inch share-size pizza of your choice, eight chicken wings and garlic bread.",
    image_key: "combo_pizza_wings_night",
    bundle_components: [
      { quantity: 1, label: "16-inch share-size pizza" },
      { quantity: 8, label: "Chicken wings" },
      { quantity: 1, label: "Garlic bread" },
    ],
  },
  {
    slug: "little-swill-burger-box",
    name: "Little Swill Burger Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 799,
    description: "A mini cheeseburger with small fries and a kids' drink.",
    image_key: "kids_little_swill_burger_box",
    bundle_components: [
      { quantity: 1, label: "Mini cheeseburger" },
      { quantity: 1, label: "Small fries" },
      { quantity: 1, label: "Kids' drink" },
    ],
    is_featured: true,
  },
  {
    slug: "mini-pizza-pals",
    name: "Mini Pizza Pals",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 849,
    description: "A personal mini pizza with a kids' drink.",
    image_key: "pizza",
    bundle_components: [
      { quantity: 1, label: "Personal mini pizza" },
      { quantity: 1, label: "Kids' drink" },
    ],
  },
  {
    slug: "chicken-dippers-box",
    name: "Chicken Dippers Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 799,
    description: "Four chicken dippers with small fries and a kids' drink.",
    image_key: "chicken",
    bundle_components: [
      { quantity: 4, label: "Chicken dippers" },
      { quantity: 1, label: "Small fries" },
      { quantity: 1, label: "Kids' drink" },
    ],
  },
  {
    slug: "little-grillers-box",
    name: "Little Grillers Box",
    category: "kids",
    quick_order_group: "kids",
    price_cents: 849,
    description: "Grilled chicken bites with small fries and a kids' drink.",
    image_key: "",
    bundle_components: [
      { quantity: 1, label: "Grilled chicken bites" },
      { quantity: 1, label: "Small fries" },
      { quantity: 1, label: "Kids' drink" },
    ],
  },
  {
    slug: "swill-scoop-cup",
    name: "Swill Scoop Cup",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 349,
    description: "One scoop of the available ice cream.",
    image_key: "",
    bundle_components: [{ quantity: 1, label: "Scoop of available ice cream" }],
    is_featured: true,
  },
  {
    slug: "double-scoop-dream",
    name: "Double Scoop Dream",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 499,
    description: "Two scoops of the available ice cream.",
    image_key: "",
    bundle_components: [{ quantity: 2, label: "Scoop of available ice cream" }],
  },
  {
    slug: "cookie-crunch-sundae",
    name: "Cookie Crunch Sundae",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 599,
    description: "Ice cream topped with cookie crumbs and chocolate sauce.",
    image_key: "",
    bundle_components: [
      { quantity: 1, label: "Scoop of available ice cream" },
      { quantity: 1, label: "Cookie crumbs" },
      { quantity: 1, label: "Chocolate sauce" },
    ],
  },
  {
    slug: "brownie-blast-sundae",
    name: "Brownie Blast Sundae",
    category: "desserts",
    quick_order_group: "desserts",
    price_cents: 649,
    description: "Ice cream with brownie pieces and chocolate fudge.",
    image_key: "",
    bundle_components: [
      { quantity: 1, label: "Scoop of available ice cream" },
      { quantity: 1, label: "Brownie pieces" },
      { quantity: 1, label: "Chocolate fudge" },
    ],
  },
];

const featuredOrder = new Map([
  ["swillhouse-classic-meal", 1],
  ["double-stack-smokehouse", 2],
  ["solo-pizza-box", 3],
  ["pizza-for-two", 4],
  ["little-swill-burger-box", 5],
  ["swill-scoop-cup", 6],
]);

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || undefined);
  const menu = db.collection("menu_items");
  const categories = db.collection("categories");
  const pizzaProducts = await menu
    .find({ category: "pizza" })
    .project({ _id: 0, id: 1, slug: 1, name: 1, is_available: 1, options: 1, sort_order: 1 })
    .sort({ sort_order: 1, name: 1 })
    .toArray();
  const supportedPizzas = pizzaProducts.filter((product) =>
    ["size", "crust", "toppings"].every((groupId) =>
      product.options?.some((group) => group.id === groupId && group.choices?.length),
    ),
  );
  if (!supportedPizzas.length) {
    throw new Error(
      "No configured pizza varieties with size, crust, and topping options were found. Seed or configure the pizza menu first.",
    );
  }

  const varietyChoices = supportedPizzas.map((product, index) => ({
    id: `variety-${index + 1}`,
    label: product.name,
    price_cents: 0,
    menu_item_id: product.id,
  }));
  const pizzaOptions = [
    {
      id: "pizza-variety",
      label: "Pizza variety",
      type: "single",
      required: true,
      choices: varietyChoices,
    },
    {
      id: "pizza-crust",
      label: "Crust",
      type: "single",
      required: true,
      source_item_group_id: "pizza-variety",
      source_option_group_id: "crust",
      choices: supportedPizzas[0].options.find((group) => group.id === "crust").choices,
    },
    {
      id: "pizza-toppings",
      label: "Extra toppings",
      type: "multi",
      source_item_group_id: "pizza-variety",
      source_option_group_id: "toppings",
      choices: supportedPizzas[0].options.find((group) => group.id === "toppings").choices,
    },
  ];

  for (const [index, product] of products.entries()) {
    const sortOrder = products
      .slice(0, index)
      .filter((previous) => previous.category === product.category).length;
    const quickOrderOrder = index + 1;
    const menuItem = {
      id: stableId(product.slug),
      ...product,
      calories: 0,
      tags: ["Combo"],
      ingredients: [],
      options: product.category === "pizza" ? pizzaOptions : [],
      is_available: true,
      is_featured: Boolean(product.is_featured),
      sort_order: sortOrder,
      currency: "USD",
      is_quick_order: true,
      quick_order_order: featuredOrder.get(product.slug) ?? quickOrderOrder,
      bundle_components: product.bundle_components,
    };
    await menu.updateOne({ slug: product.slug }, { $setOnInsert: menuItem }, { upsert: true });
  }

  for (const category of categoryRecords) {
    await categories.updateOne({ id: category.id }, { $setOnInsert: category }, { upsert: true });
  }

  const comboCount = await menu.countDocuments({ is_quick_order: true });
  console.log(
    `Combo menu seed complete: ${products.length} products added or already managed, ${comboCount} Quick Order products in MongoDB.`,
  );
} finally {
  await client.close();
}
