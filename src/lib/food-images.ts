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
};

export const CATEGORY_IMAGES = {
  burgers: burger,
  chicken,
  pizza,
  sides: fries,
  drinks: coldbrew,
} as const;

export function foodImage(key: string): string {
  if (key.startsWith("/") && !key.startsWith("//")) return key;
  if (key.startsWith("https://")) return key;
  return MAP[key] ?? burger;
}
