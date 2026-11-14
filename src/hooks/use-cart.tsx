import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { CartLine, Fulfillment } from "@/lib/menu-types";

const STORAGE_KEY = "grill-swill-cart-v1";

interface CartState {
  lines: CartLine[];
  fulfillment: Fulfillment;
  storeId: string | null;
}

interface CartContextValue extends CartState {
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addLine: (line: Omit<CartLine, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  setFulfillment: (f: Fulfillment) => void;
  setStoreId: (id: string | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function lineKey(line: Pick<CartLine, "itemId" | "selections" | "removed" | "note">): string {
  const sel = Object.keys(line.selections)
    .sort()
    .map((k) => `${k}:${[...(line.selections[k] ?? [])].sort().join(",")}`)
    .join("|");
  return `${line.itemId}#${sel}#${[...line.removed].sort().join(",")}#${line.note.trim()}`;
}

/** Pure cart reducer helpers, exported for tests. */
export function addLineTo(lines: CartLine[], line: Omit<CartLine, "key">): CartLine[] {
  const key = lineKey(line);
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l));
  }
  return [...lines, { ...line, key }];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ lines: [], fulfillment: "delivery", storeId: null });
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CartState>;
        setState({
          lines: Array.isArray(parsed.lines) ? parsed.lines : [],
          fulfillment: parsed.fulfillment === "pickup" ? "pickup" : "delivery",
          storeId: typeof parsed.storeId === "string" ? parsed.storeId : null,
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addLine = useCallback((line: Omit<CartLine, "key">) => {
    setState((s) => ({ ...s, lines: addLineTo(s.lines, line) }));
  }, []);
  const updateQuantity = useCallback((key: string, quantity: number) => {
    setState((s) => ({
      ...s,
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.key !== key)
          : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, quantity) } : l)),
    }));
  }, []);
  const removeLine = useCallback((key: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));
  }, []);
  const clear = useCallback(() => setState((s) => ({ ...s, lines: [] })), []);
  const setFulfillment = useCallback((fulfillment: Fulfillment) => setState((s) => ({ ...s, fulfillment })), []);
  const setStoreId = useCallback((storeId: string | null) => setState((s) => ({ ...s, storeId })), []);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      hydrated,
      count: state.lines.reduce((n, l) => n + l.quantity, 0),
      subtotalCents: state.lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0),
      isOpen,
      setOpen,
      addLine,
      updateQuantity,
      removeLine,
      clear,
      setFulfillment,
      setStoreId,
    }),
    [state, hydrated, isOpen, addLine, updateQuantity, removeLine, clear, setFulfillment, setStoreId],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
