import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

for (const path of [".env.local", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Set MONGODB_URI before running the MongoDB seed script.");
}

const database = process.env.MONGODB_DATABASE;

const categories = [
  {
    id: "burgers",
    label: "Burgers & Combos",
    short: "Burgers",
    blurb: "Smashed to order on a 500° flat-top.",
    sort_order: 1,
  },
  {
    id: "chicken",
    label: "Crispy Chicken",
    short: "Chicken",
    blurb: "Buttermilk-brined, hand-breaded daily.",
    sort_order: 2,
  },
  {
    id: "pizza",
    label: "Fresh Pizzas",
    short: "Pizza",
    blurb: "48-hour dough, blistered in a wood oven.",
    sort_order: 3,
  },
  {
    id: "sides",
    label: "Fries & Sides",
    short: "Sides",
    blurb: "Cut in-house. Never frozen.",
    sort_order: 4,
  },
  {
    id: "drinks",
    label: "Coffee & Drinks",
    short: "Drinks",
    blurb: "18-hour cold brew & hand-spun shakes.",
    sort_order: 5,
  },
];

const burgerOptions = [
  {
    id: "patty",
    label: "Patties",
    type: "single",
    required: true,
    choices: [
      { id: "single", label: "Single", price_cents: 0 },
      { id: "double", label: "Double", price_cents: 250 },
      { id: "triple", label: "Triple", price_cents: 450 },
    ],
  },
  {
    id: "addons",
    label: "Add-ons",
    type: "multi",
    choices: [
      { id: "cheese", label: "Extra cheddar", price_cents: 100 },
      { id: "bacon", label: "Applewood bacon", price_cents: 200 },
      { id: "egg", label: "Fried egg", price_cents: 150 },
      { id: "jalapeno", label: "Grilled jalapeños", price_cents: 75 },
    ],
  },
  {
    id: "sauce",
    label: "Sauce",
    type: "single",
    required: true,
    choices: [
      { id: "swill", label: "Swill Sauce", price_cents: 0 },
      { id: "bbq", label: "Smoky BBQ", price_cents: 0 },
      { id: "chipotle", label: "Chipotle mayo", price_cents: 0 },
      { id: "none", label: "No sauce", price_cents: 0 },
    ],
  },
  {
    id: "combo",
    label: "Make it a combo",
    type: "single",
    required: true,
    choices: [
      { id: "none", label: "Just the burger", price_cents: 0 },
      { id: "classic", label: "+ Fries & fountain drink", price_cents: 399 },
      { id: "loaded", label: "+ Loaded fries & shake", price_cents: 699 },
    ],
  },
];

const chickenOptions = [
  {
    id: "heat",
    label: "Heat level",
    type: "single",
    required: true,
    choices: ["Mild", "Medium", "Hot", "Reaper (sign the waiver)"].map((label, index) => ({
      id: ["mild", "medium", "hot", "reaper"][index],
      label,
      price_cents: 0,
    })),
  },
  {
    id: "dips",
    label: "Extra dips",
    type: "multi",
    choices: [
      { id: "ranch", label: "Buttermilk ranch", price_cents: 60 },
      { id: "honey", label: "Hot honey", price_cents: 60 },
      { id: "swill", label: "Swill Sauce", price_cents: 60 },
    ],
  },
  {
    id: "combo",
    label: "Make it a combo",
    type: "single",
    required: true,
    choices: [
      { id: "none", label: "Just the chicken", price_cents: 0 },
      { id: "classic", label: "+ Fries & fountain drink", price_cents: 399 },
    ],
  },
];

const pizzaOptions = [
  {
    id: "size",
    label: "Size",
    type: "single",
    required: true,
    choices: [
      { id: "12", label: '12" personal', price_cents: 0 },
      { id: "16", label: '16" share', price_cents: 500 },
    ],
  },
  {
    id: "crust",
    label: "Crust",
    type: "single",
    required: true,
    choices: [
      { id: "classic", label: "48-hour classic", price_cents: 0 },
      { id: "thin", label: "Crackly thin", price_cents: 0 },
      { id: "cauli", label: "Cauliflower", price_cents: 200 },
    ],
  },
  {
    id: "toppings",
    label: "Extra toppings",
    type: "multi",
    choices: [
      { id: "mozz", label: "Extra mozzarella", price_cents: 150 },
      { id: "pep", label: "Cup-and-char pepperoni", price_cents: 200 },
      { id: "mush", label: "Roasted mushrooms", price_cents: 125 },
      { id: "honey", label: "Hot honey drizzle", price_cents: 100 },
    ],
  },
];

const sideOptions = [
  {
    id: "size",
    label: "Size",
    type: "single",
    required: true,
    choices: [
      { id: "reg", label: "Regular", price_cents: 0 },
      { id: "lg", label: "Large", price_cents: 150 },
    ],
  },
  {
    id: "dips",
    label: "Dipping sauce",
    type: "multi",
    choices: [
      { id: "swill", label: "Swill Sauce", price_cents: 60 },
      { id: "ranch", label: "Buttermilk ranch", price_cents: 60 },
      { id: "cheese", label: "Cheddar sauce", price_cents: 90 },
    ],
  },
];

const coffeeOptions = [
  {
    id: "size",
    label: "Size",
    type: "single",
    required: true,
    choices: [
      { id: "12", label: "12 oz", price_cents: 0 },
      { id: "16", label: "16 oz", price_cents: 75 },
      { id: "24", label: "24 oz", price_cents: 150 },
    ],
  },
  {
    id: "milk",
    label: "Milk",
    type: "single",
    required: true,
    choices: [
      { id: "whole", label: "Whole milk", price_cents: 0 },
      { id: "oat", label: "Oat milk", price_cents: 75 },
      { id: "almond", label: "Almond milk", price_cents: 75 },
      { id: "none", label: "No milk", price_cents: 0 },
    ],
  },
  {
    id: "extras",
    label: "Extras",
    type: "multi",
    choices: [
      { id: "shot", label: "Extra espresso shot", price_cents: 100 },
      { id: "vanilla", label: "Vanilla syrup", price_cents: 60 },
      { id: "caramel", label: "Caramel drizzle", price_cents: 60 },
      { id: "foam", label: "Sweet cream cold foam", price_cents: 125 },
    ],
  },
];

const coldDrinkOptions = [
  {
    id: "size",
    label: "Size",
    type: "single",
    required: true,
    choices: [
      { id: "16", label: "16 oz", price_cents: 0 },
      { id: "24", label: "24 oz", price_cents: 125 },
    ],
  },
  {
    id: "extras",
    label: "Extras",
    type: "multi",
    choices: [
      { id: "whip", label: "Extra whipped cream", price_cents: 50 },
      { id: "malt", label: "Malt it", price_cents: 75 },
    ],
  },
];

const stores = [
  [
    "South Congress",
    "1412 S Congress Ave",
    "Austin",
    "TX",
    "78704",
    "(512) 555-0142",
    30.2489,
    -97.7497,
    "Daily 7am – 11pm",
    ["Drive-thru", "Patio", "Delivery"],
  ],
  [
    "Deep Ellum",
    "2700 Elm St",
    "Dallas",
    "TX",
    "75226",
    "(214) 555-0187",
    32.7838,
    -96.7826,
    "Daily 7am – 12am",
    ["Late night", "Delivery", "Curbside"],
  ],
  [
    "The Heights",
    "312 W 19th St",
    "Houston",
    "TX",
    "77008",
    "(713) 555-0119",
    29.8028,
    -95.4005,
    "Daily 6:30am – 11pm",
    ["Drive-thru", "Coffee bar", "Delivery"],
  ],
  [
    "Pearl District",
    "303 Pearl Pkwy",
    "San Antonio",
    "TX",
    "78215",
    "(210) 555-0164",
    29.4425,
    -98.4799,
    "Daily 7am – 10pm",
    ["Patio", "Curbside"],
  ],
  [
    "East Nashville",
    "1006 Fatherland St",
    "Nashville",
    "TN",
    "37206",
    "(615) 555-0133",
    36.1745,
    -86.7516,
    "Daily 7am – 11pm",
    ["Drive-thru", "Delivery"],
  ],
  [
    "Ponce City",
    "675 Ponce De Leon Ave NE",
    "Atlanta",
    "GA",
    "30308",
    "(404) 555-0108",
    33.7722,
    -84.3658,
    "Daily 7am – 11pm",
    ["Coffee bar", "Delivery", "Curbside"],
  ],
].map(([name, address, city, state, zip, phone, lat, lng, hours, features], index) => ({
  id: randomUUID(),
  name,
  address,
  city,
  state,
  zip,
  phone,
  lat,
  lng,
  hours,
  features,
  sort_order: index + 1,
}));

const rawMenu = [
  [
    "swill-smash",
    "burgers",
    "The Swill Smash",
    "Two smashed chuck-and-brisket patties, melted American, caramelized onions, house pickles and Swill Sauce on a toasted brioche bun.",
    899,
    780,
    "burger",
    ["Signature", "Bestseller"],
    [
      "Brioche bun",
      "Chuck & brisket patty",
      "American cheese",
      "Caramelized onions",
      "House pickles",
      "Swill Sauce",
    ],
    "burger",
    true,
  ],
  [
    "ember-bacon",
    "burgers",
    "Ember Bacon Burger",
    "Fire-grilled patty, thick applewood bacon, aged cheddar, vine tomato and crisp lettuce on a sesame bun.",
    1049,
    910,
    "bacon_burger",
    ["Fan favorite"],
    [
      "Sesame bun",
      "Fire-grilled patty",
      "Applewood bacon",
      "Aged cheddar",
      "Tomato",
      "Green leaf lettuce",
      "Mayo",
    ],
    "burger",
    true,
  ],
  [
    "hickory-stack",
    "burgers",
    "Hickory BBQ Stack",
    "Double patty, smoked gouda, crispy onion strings and molasses BBQ sauce.",
    1099,
    960,
    "bacon_burger",
    ["Smoky"],
    ["Brioche bun", "Chuck & brisket patty", "Smoked gouda", "Onion strings", "Molasses BBQ"],
    "burger",
    false,
  ],
  [
    "garden-ember",
    "burgers",
    "Fire-Grilled Garden Burger",
    "Black bean, roasted corn and poblano patty with pepper jack, avocado and chipotle mayo.",
    929,
    640,
    "bacon_burger",
    ["Vegetarian"],
    ["Sesame bun", "Black bean patty", "Pepper jack", "Avocado", "Chipotle mayo", "Lettuce"],
    "burger",
    false,
  ],
  [
    "crispy-classic",
    "chicken",
    "Crispy Classic Sandwich",
    "Buttermilk-brined thigh, pressure-fried golden, with pickles and spicy mayo on a buttered bun.",
    849,
    690,
    "chicken",
    ["Bestseller"],
    ["Brioche bun", "Buttermilk-brined chicken", "Pickles", "Spicy mayo"],
    "chicken",
    true,
  ],
  [
    "nashville-hot",
    "chicken",
    "Nashville Hot Sandwich",
    "Cayenne-lacquered crispy chicken, vinegar slaw and crinkle pickles.",
    929,
    740,
    "hot_chicken",
    ["Spicy"],
    ["Brioche bun", "Crispy chicken", "Nashville hot oil", "Vinegar slaw", "Crinkle pickles"],
    "chicken",
    true,
  ],
  [
    "tenders-four",
    "chicken",
    "Hand-Breaded Tenders (4)",
    "Four whole-muscle tenders, breaded by hand every morning. Pick your heat.",
    899,
    620,
    "chicken",
    ["Hand-breaded"],
    ["Chicken tenderloin", "Seasoned flour", "Buttermilk"],
    "chicken",
    false,
  ],
  [
    "smoked-wings",
    "chicken",
    "Hickory Smoked Wings (8)",
    "Smoked low for three hours, flash-fried and tossed in your heat of choice.",
    1149,
    820,
    "hot_chicken",
    ["Smoky"],
    ["Chicken wings", "Hickory smoke", "House rub"],
    "chicken",
    false,
  ],
  [
    "pepperoni-blaze",
    "pizza",
    "Pepperoni Blaze",
    "Cup-and-char pepperoni, fior di latte, San Marzano tomato and torn basil on our 48-hour dough.",
    1399,
    1120,
    "pizza",
    ["Wood-fired", "Bestseller"],
    ["48-hour dough", "San Marzano tomato", "Fior di latte", "Cup-and-char pepperoni", "Basil"],
    "pizza",
    true,
  ],
  [
    "margherita",
    "pizza",
    "Fresh Margherita",
    "Hand-pulled mozzarella, crushed tomato, basil and cold-pressed olive oil.",
    1249,
    980,
    "margherita",
    ["Vegetarian", "Wood-fired"],
    ["48-hour dough", "Crushed tomato", "Fresh mozzarella", "Basil", "Olive oil"],
    "pizza",
    false,
  ],
  [
    "hot-honey",
    "pizza",
    "Hot Honey Soppressata",
    "Spicy soppressata, mozzarella, Calabrian chili and a hot honey finish.",
    1499,
    1180,
    "pizza",
    ["Sweet heat"],
    ["48-hour dough", "Tomato", "Mozzarella", "Soppressata", "Calabrian chili", "Hot honey"],
    "pizza",
    false,
  ],
  [
    "bbq-chicken-pie",
    "pizza",
    "BBQ Chicken Pie",
    "Smoked chicken, red onion, smoked gouda, cilantro and molasses BBQ.",
    1449,
    1150,
    "margherita",
    ["Smoky"],
    ["48-hour dough", "Molasses BBQ", "Smoked chicken", "Red onion", "Smoked gouda", "Cilantro"],
    "pizza",
    false,
  ],
  [
    "hand-cut-fries",
    "sides",
    "Hand-Cut Fries",
    "Idaho potatoes, cut in-house, twice-fried in peanut oil and showered with sea salt.",
    349,
    420,
    "fries",
    ["Cut daily"],
    ["Idaho potatoes", "Peanut oil", "Sea salt"],
    "sides",
    true,
  ],
  [
    "loaded-fries",
    "sides",
    "Loaded Swill Fries",
    "Hand-cut fries buried in cheddar sauce, bacon crumble, jalapeños and Swill Sauce.",
    649,
    780,
    "fries",
    ["Shareable"],
    ["Idaho potatoes", "Cheddar sauce", "Bacon", "Jalapeños", "Swill Sauce"],
    "sides",
    false,
  ],
  [
    "onion-rings",
    "sides",
    "Beer-Battered Onion Rings",
    "Sweet onions dipped in lager batter and fried crisp. Served with comeback sauce.",
    449,
    510,
    "onion_rings",
    ["Crunchy"],
    ["Sweet onion", "Lager batter", "Comeback sauce"],
    "sides",
    false,
  ],
  [
    "swill-cold-brew",
    "drinks",
    "Swill Cold Brew",
    "Small-batch beans steeped for 18 hours, poured over ice with a cream swirl.",
    499,
    140,
    "coldbrew",
    ["Specialty coffee", "18-hr steep"],
    ["Cold brew coffee", "Ice", "Cream"],
    "coffee",
    true,
  ],
  [
    "caramel-latte",
    "drinks",
    "Smoked Caramel Latte",
    "Double ristretto, burnt-sugar caramel and steamed milk. Hot or iced.",
    549,
    260,
    "coldbrew",
    ["Specialty coffee"],
    ["Espresso", "Caramel", "Milk"],
    "coffee",
    false,
  ],
  [
    "vanilla-shake",
    "drinks",
    "Hand-Spun Vanilla Shake",
    "Real vanilla bean custard, spun thick, topped with whipped cream and a cherry.",
    599,
    690,
    "shake",
    ["Hand-spun"],
    ["Vanilla custard", "Whole milk", "Whipped cream", "Cherry"],
    "cold",
    true,
  ],
  [
    "honey-lemonade",
    "drinks",
    "Fresh Honey Lemonade",
    "Lemons squeezed every morning, sweetened with wildflower honey.",
    349,
    180,
    "lemonade",
    ["Fresh-squeezed"],
    ["Lemon juice", "Wildflower honey", "Water", "Ice"],
    "cold",
    false,
  ],
];

const optionGroups = {
  burger: burgerOptions,
  chicken: chickenOptions,
  pizza: pizzaOptions,
  sides: sideOptions,
  coffee: coffeeOptions,
  cold: coldDrinkOptions,
};
const sortByCategory = new Map();
const menuItems = rawMenu.map(
  ([
    slug,
    category,
    name,
    description,
    price_cents,
    calories,
    image_key,
    tags,
    ingredients,
    optionKey,
    is_featured,
  ]) => {
    const sort_order = (sortByCategory.get(category) ?? 0) + 1;
    sortByCategory.set(category, sort_order);
    return {
      id: randomUUID(),
      slug,
      category,
      name,
      description,
      price_cents,
      calories,
      image_key,
      tags,
      ingredients,
      options: structuredClone(optionGroups[optionKey]),
      is_available: true,
      is_featured,
      sort_order,
    };
  },
);

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(database || undefined);
  const menu = db.collection("menu_items");
  const categoryCollection = db.collection("categories");
  const storeCollection = db.collection("stores");

  if ((await menu.countDocuments()) === 0) {
    await menu.insertMany(menuItems);
  }
  if ((await categoryCollection.countDocuments()) === 0) {
    await categoryCollection.insertMany(categories);
  }
  if ((await storeCollection.countDocuments()) === 0) {
    await storeCollection.insertMany(stores);
  }
  console.log(
    `MongoDB seed complete: ${await menu.countDocuments()} menu items, ${await categoryCollection.countDocuments()} categories, ${await storeCollection.countDocuments()} stores.`,
  );
} finally {
  await client.close();
}
