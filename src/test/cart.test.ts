import { describe, expect, it } from "vitest";

import { addLineTo, lineKey } from "@/hooks/use-cart";
import type { CartLine } from "@/lib/menu-types";

const line: Omit<CartLine, "key"> = {
  itemId: "burger-1",
  slug: "classic",
  category: "burgers",
  name: "Classic",
  imageKey: "burger",
  quantity: 1,
  selections: { cheese: ["american"] },
  removed: [],
  note: "",
  unitPriceCents: 950,
  summary: ["American cheese"],
};

describe("cart line identity", () => {
  it("combines matching customizations but keeps different notes or selections separate", () => {
    const first = addLineTo([], line);
    expect(addLineTo(first, { ...line, quantity: 2 })).toHaveLength(1);
    expect(addLineTo(first, { ...line, note: "No pickles" })).toHaveLength(2);
    expect(lineKey({ ...line, selections: { cheese: ["american", "swiss"] } })).not.toBe(
      lineKey(line),
    );
  });

  it("caps a combined line at the supported quantity", () => {
    const many = addLineTo([{ ...line, key: lineKey(line), quantity: 19 }], {
      ...line,
      quantity: 4,
    });
    expect(many[0]?.quantity).toBe(20);
  });
});
