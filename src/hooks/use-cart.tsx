import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { getCart, saveCart } from "@/lib/cart.functions";
import type { CartLine, Fulfillment } from "@/lib/menu-types";
import { useGuestId } from "./use-guest";

const STORAGE_KEY = "grill-swill-cart-v1";
const REMOTE_LOAD_ATTEMPTS = 2;
const REMOTE_RETRY_DELAY_MS = 750;

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

export function lineKey(
  line: Pick<CartLine, "itemId" | "selections"> & {
    removed?: CartLine["removed"] | undefined;
    note?: CartLine["note"] | undefined;
  },
): string {
  const sel = Object.keys(line.selections ?? {})
    .sort()
    .map((k) => `${k}:${[...((line.selections ?? {})[k] ?? [])].sort().join(",")}`)
    .join("|");
  const removed = Array.isArray(line.removed) ? [...line.removed].sort().join(",") : "";
  const note = typeof line.note === "string" ? line.note.trim() : "";
  return `${line.itemId}#${sel}#${removed}#${note}`;
}

/** Pure cart reducer helpers, exported for tests. */
export function addLineTo(lines: CartLine[], line: Omit<CartLine, "key">): CartLine[] {
  const qty = Number.isFinite(line.quantity) ? Math.max(0, Math.floor(line.quantity)) : 0;
  if (qty <= 0) return lines;

  const key = lineKey(line);
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) =>
      l.key === key ? { ...l, quantity: Math.min(20, l.quantity + qty) } : l,
    );
  }
  return [...lines, { ...line, quantity: Math.min(20, qty), key }];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const guestId = useGuestId();
  const [state, setState] = useState<CartState>({
    lines: [],
    fulfillment: "delivery",
    storeId: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const clearedWhileLoading = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CartState>;
        setState((current) =>
          current.lines.length
            ? current
            : {
                lines: Array.isArray(parsed.lines) ? parsed.lines : [],
                fulfillment: parsed.fulfillment === "pickup" ? "pickup" : "delivery",
                storeId: typeof parsed.storeId === "string" ? parsed.storeId : null,
              },
        );
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

  useEffect(() => {
    if (!hydrated || !guestId) return;
    let active = true;

    async function loadRemoteCart() {
      let lastError: unknown;
      for (let attempt = 0; attempt < REMOTE_LOAD_ATTEMPTS; attempt += 1) {
        try {
          const saved = await getCart({ data: { guestId } });
          if (!active) return;
          if (saved && !clearedWhileLoading.current) {
            setState((current) =>
              current.lines.length > 0
                ? current
                : { lines: saved.lines, fulfillment: saved.fulfillment, storeId: saved.storeId },
            );
          }
          setRemoteAvailable(true);
          setRemoteLoaded(true);
          return;
        } catch (error) {
          lastError = error;
          if (attempt + 1 < REMOTE_LOAD_ATTEMPTS) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, REMOTE_RETRY_DELAY_MS);
            });
          }
        }
      }

      if (!active) return;
      // Remote persistence is an enhancement; the device cart remains authoritative
      // when MongoDB or the server-function request is temporarily unavailable.
      console.warn("Remote cart unavailable; continuing with the device cart.", lastError);
      setRemoteLoaded(true);
    }

    void loadRemoteCart();
    return () => {
      active = false;
    };
  }, [guestId, hydrated]);

  useEffect(() => {
    if (!remoteLoaded || !remoteAvailable || !hydrated || !guestId) return;
    const timer = window.setTimeout(() => {
      void saveCart({
        data: {
          guestId,
          lines: state.lines,
          fulfillment: state.fulfillment,
          storeId: state.storeId,
        },
      }).catch(() => {
        toast.error("Your bag couldn't be saved online. It remains saved on this device.");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [guestId, hydrated, remoteAvailable, remoteLoaded, state]);

  const addLine = useCallback((line: Omit<CartLine, "key">) => {
    setState((s) => ({ ...s, lines: addLineTo(s.lines, line) }));
  }, []);
  const updateQuantity = useCallback((key: string, quantity: number) => {
    const normalized = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
    setState((s) => ({
      ...s,
      lines:
        normalized <= 0
          ? s.lines.filter((l) => l.key !== key)
          : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, normalized) } : l)),
    }));
  }, []);
  const removeLine = useCallback((key: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));
  }, []);
  const clear = useCallback(() => {
    clearedWhileLoading.current = true;
    setState((s) => ({ ...s, lines: [] }));
  }, []);
  const setFulfillment = useCallback(
    (fulfillment: Fulfillment) => setState((s) => ({ ...s, fulfillment })),
    [],
  );
  const setStoreId = useCallback(
    (storeId: string | null) => setState((s) => ({ ...s, storeId })),
    [],
  );

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
    [
      state,
      hydrated,
      isOpen,
      addLine,
      updateQuantity,
      removeLine,
      clear,
      setFulfillment,
      setStoreId,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
