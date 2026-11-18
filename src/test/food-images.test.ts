import { describe, expect, it } from "vitest";

import { PRODUCT_IMAGES, foodImage } from "@/lib/food-images";

const COMBO_AND_MENU_SLUGS = [
  "swillhouse-classic-meal",
  "double-stack-smokehouse",
  "firecracker-chicken-meal",
  "sticky-bbq-wings-box",
  "flame-grilled-chicken-meal",
  "swill-crunch-combo",
  "solo-pizza-box",
  "pizza-for-two",
  "swill-pizza-feast",
  "pizza-wings-night",
  "little-swill-burger-box",
  "mini-pizza-pals",
  "chicken-dippers-box",
  "little-grillers-box",
  "swill-scoop-cup",
  "double-scoop-dream",
  "cookie-crunch-sundae",
  "brownie-blast-sundae",
  "loaded-fries",
];

describe("menu image lookup", () => {
  it("leaves unsupported image keys blank instead of reusing unrelated food imagery", () => {
    expect(foodImage("unconfigured-dessert")).toBe("");
  });

  it("gives every combo, kids' meal, dessert and loaded fries its own photo", () => {
    const photos = COMBO_AND_MENU_SLUGS.map((slug) => PRODUCT_IMAGES[slug]);
    expect(photos.every(Boolean)).toBe(true);
    expect(new Set(photos).size).toBe(COMBO_AND_MENU_SLUGS.length);
  });

  it("replaces a shared stock photo with the product's own photo", () => {
    expect(foodImage("", "swill-scoop-cup")).toBe(PRODUCT_IMAGES["swill-scoop-cup"]);
    expect(foodImage("fries", "loaded-fries")).not.toBe(foodImage("fries", "hand-cut-fries"));
  });

  it("keeps a photo uploaded in the admin dashboard", () => {
    expect(foodImage("/api/media/abc123", "pizza-for-two")).toBe("/api/media/abc123");
  });
});
