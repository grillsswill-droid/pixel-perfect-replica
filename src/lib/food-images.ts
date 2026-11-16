import burger from "@/assets/food-burger.jpg";
import baconBurger from "@/assets/food-bacon-burger.jpg";
import chicken from "@/assets/food-chicken.jpg";
import hotChicken from "@/assets/food-hot-chicken.jpg";
import pizza from "@/assets/food-pizza.jpg";
import margherita from "@/assets/food-margherita.jpg";
import fries from "@/assets/food-fries.jpg";
import onionRings from "@/assets/food-onion-rings.jpg";
import coldbrew from "@/assets/food-coldbrew.jpg";
import shake from "@/assets/food-shake.jpg";
import lemonade from "@/assets/food-lemonade.jpg";
import comboDoubleStackSmokehouse from "../../lovimg/combo-double-stack-smokehouse.jpg";
import comboFirecrackerChicken from "../../lovimg/combo-firecracker-chicken.jpg";
import comboFlameGrilledChicken from "../../lovimg/combo-flame-grilled-chicken.jpg";
import comboPizzaForTwo from "../../lovimg/combo-pizza-for-two.jpg";
import comboPizzaWingsNight from "../../lovimg/combo-pizza-wings-night.jpg";
import comboSoloPizzaBox from "../../lovimg/combo-solo-pizza-box.jpg";
import comboStickyBbqWings from "../../lovimg/combo-sticky-bbq-wings.jpg";
import comboSwillCrunch from "../../lovimg/combo-swill-crunch.jpg";
import comboSwillPizzaFeast from "../../lovimg/combo-swill-pizza-feast.jpg";
import comboSwillhouseClassic from "../../lovimg/combo-swillhouse-classic.jpg";
import kidsLittleSwillBurgerBox from "../../lovimg/kids-little-swill-burger-box.jpg";
import type { CategoryId } from "./menu-types";

const MAP: Record<string, string> = {
  burger,
  bacon_burger: baconBurger,
  chicken,
  hot_chicken: hotChicken,
  pizza,
  margherita,
  fries,
  onion_rings: onionRings,
  coldbrew,
  shake,
  lemonade,
  combo_double_stack_smokehouse: comboDoubleStackSmokehouse,
  combo_firecracker_chicken: comboFirecrackerChicken,
  combo_flame_grilled_chicken: comboFlameGrilledChicken,
  combo_pizza_for_two: comboPizzaForTwo,
  combo_pizza_wings_night: comboPizzaWingsNight,
  combo_solo_pizza_box: comboSoloPizzaBox,
  combo_sticky_bbq_wings: comboStickyBbqWings,
  combo_swill_crunch: comboSwillCrunch,
  combo_swill_pizza_feast: comboSwillPizzaFeast,
  combo_swillhouse_classic: comboSwillhouseClassic,
  kids_little_swill_burger_box: kidsLittleSwillBurgerBox,
};

const PRODUCT_IMAGES: Record<string, string> = {
  "swillhouse-classic-meal": comboSwillhouseClassic,
  "double-stack-smokehouse": comboDoubleStackSmokehouse,
  "firecracker-chicken-meal": comboFirecrackerChicken,
  "sticky-bbq-wings-box": comboStickyBbqWings,
  "flame-grilled-chicken-meal": comboFlameGrilledChicken,
  "swill-crunch-combo": comboSwillCrunch,
  "solo-pizza-box": comboSoloPizzaBox,
  "pizza-for-two": comboPizzaForTwo,
  "swill-pizza-feast": comboSwillPizzaFeast,
  "pizza-wings-night": comboPizzaWingsNight,
  "little-swill-burger-box": kidsLittleSwillBurgerBox,
};

const GENERIC_IMAGE_KEYS = new Set([
  "",
  "burger",
  "bacon_burger",
  "chicken",
  "hot_chicken",
  "pizza",
  "margherita",
  "fries",
]);

export const CATEGORY_IMAGES: Partial<Record<CategoryId, string>> = {
  burgers: burger,
  chicken,
  pizza,
  sides: fries,
  drinks: coldbrew,
} as const;

export function foodImage(key: string, productSlug?: string): string {
  if (key.startsWith("/") && !key.startsWith("//")) return key;
  if (key.startsWith("https://")) return key;
  if (productSlug && GENERIC_IMAGE_KEYS.has(key) && PRODUCT_IMAGES[productSlug]) {
    return PRODUCT_IMAGES[productSlug];
  }
  return MAP[key] ?? (productSlug ? PRODUCT_IMAGES[productSlug] : "") ?? "";
}
