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

  it("handles legacy lines with missing note or removed values without crashing", () => {
    const key = lineKey({
      ...line,
      note: undefined,
      removed: undefined,
    });

    expect(key).toContain("burger-1#");
    expect(addLineTo([], { ...line, quantity: 1, note: undefined as never })).toHaveLength(1);
  });

  it("caps a combined line at the supported quantity and ignores invalid additions", () => {
    const many = addLineTo([{ ...line, key: lineKey(line), quantity: 19 }], {
      ...line,
      quantity: 4,
    });
    expect(many[0]?.quantity).toBe(20);
    expect(addLineTo([{ ...line, key: lineKey(line), quantity: 1 }], { ...line, quantity: 0 })).toHaveLength(1);
  });
});
