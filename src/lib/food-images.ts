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
import comboSwillhouseClassic from "@/assets/menu/combo-swillhouse-classic.webp";
import comboDoubleStackSmokehouse from "@/assets/menu/combo-double-stack-smokehouse.webp";
import comboFirecrackerChicken from "@/assets/menu/combo-firecracker-chicken.webp";
import comboStickyBbqWings from "@/assets/menu/combo-sticky-bbq-wings.webp";
import comboFlameGrilledChicken from "@/assets/menu/combo-flame-grilled-chicken.webp";
import comboSwillCrunch from "@/assets/menu/combo-swill-crunch.webp";
import comboSoloPizzaBox from "@/assets/menu/combo-solo-pizza-box.webp";
import comboPizzaForTwo from "@/assets/menu/combo-pizza-for-two.webp";
import comboSwillPizzaFeast from "@/assets/menu/combo-swill-pizza-feast.webp";
import comboPizzaWingsNight from "@/assets/menu/combo-pizza-wings-night.webp";
import kidsLittleSwillBurgerBox from "@/assets/menu/kids-little-swill-burger-box.webp";
import kidsMiniPizzaPals from "@/assets/menu/kids-mini-pizza-pals.webp";
import kidsChickenDippersBox from "@/assets/menu/kids-chicken-dippers-box.webp";
import kidsLittleGrillersBox from "@/assets/menu/kids-little-grillers-box.webp";
import dessertSwillScoopCup from "@/assets/menu/dessert-swill-scoop-cup.webp";
import dessertDoubleScoopDream from "@/assets/menu/dessert-double-scoop-dream.webp";
import dessertCookieCrunchSundae from "@/assets/menu/dessert-cookie-crunch-sundae.webp";
import dessertBrownieBlastSundae from "@/assets/menu/dessert-brownie-blast-sundae.webp";
import sideLoadedSwillFries from "@/assets/menu/side-loaded-swill-fries.webp";
import type { CategoryId } from "./menu-types";

/** Photos addressed by a menu item's image_key. */
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
  combo_swillhouse_classic: comboSwillhouseClassic,
  combo_double_stack_smokehouse: comboDoubleStackSmokehouse,
  combo_firecracker_chicken: comboFirecrackerChicken,
  combo_sticky_bbq_wings: comboStickyBbqWings,
  combo_flame_grilled_chicken: comboFlameGrilledChicken,
  combo_swill_crunch: comboSwillCrunch,
  combo_solo_pizza_box: comboSoloPizzaBox,
  combo_pizza_for_two: comboPizzaForTwo,
  combo_swill_pizza_feast: comboSwillPizzaFeast,
  combo_pizza_wings_night: comboPizzaWingsNight,
  kids_little_swill_burger_box: kidsLittleSwillBurgerBox,
  kids_mini_pizza_pals: kidsMiniPizzaPals,
  kids_chicken_dippers_box: kidsChickenDippersBox,
  kids_little_grillers_box: kidsLittleGrillersBox,
  dessert_swill_scoop_cup: dessertSwillScoopCup,
  dessert_double_scoop_dream: dessertDoubleScoopDream,
  dessert_cookie_crunch_sundae: dessertCookieCrunchSundae,
  dessert_brownie_blast_sundae: dessertBrownieBlastSundae,
  loaded_fries: sideLoadedSwillFries,
};

/** Each product's own photo, addressed by its stable slug. */
export const PRODUCT_IMAGES: Record<string, string> = {
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
  "mini-pizza-pals": kidsMiniPizzaPals,
  "chicken-dippers-box": kidsChickenDippersBox,
  "little-grillers-box": kidsLittleGrillersBox,
  "swill-scoop-cup": dessertSwillScoopCup,
  "double-scoop-dream": dessertDoubleScoopDream,
  "cookie-crunch-sundae": dessertCookieCrunchSundae,
  "brownie-blast-sundae": dessertBrownieBlastSundae,
  "loaded-fries": sideLoadedSwillFries,
};

/** Shared stock keys older records carry; a product's own photo replaces them. */
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
  kids: kidsLittleSwillBurgerBox,
  desserts: dessertBrownieBlastSundae,
} as const;

export function foodImage(key: string, productSlug?: string): string {
  if (key.startsWith("/") && !key.startsWith("//")) return key;
  if (key.startsWith("https://")) return key;
  if (productSlug && GENERIC_IMAGE_KEYS.has(key) && PRODUCT_IMAGES[productSlug]) {
    return PRODUCT_IMAGES[productSlug];
  }
  return MAP[key] ?? (productSlug ? PRODUCT_IMAGES[productSlug] : undefined) ?? "";
}
