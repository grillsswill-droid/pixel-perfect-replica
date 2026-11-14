import { AnimatePresence, motion } from "motion/react";
import { Check, Flame, Leaf } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/hooks/use-cart";
import { foodImage } from "@/lib/food-images";
import type { MenuItem, Selections } from "@/lib/menu-types";
import { defaultSelections, formatMoney, selectionSummary, unitPriceCents } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";

export function ItemCustomizer({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden border-0 bg-background p-0 sm:max-w-2xl sm:rounded-3xl">
        {item && <CustomizerBody key={item.id} item={item} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function CustomizerBody({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const cart = useCart();
  const [selections, setSelections] = useState<Selections>(() => defaultSelections(item));
  const [removed, setRemoved] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(onDone, 650);
    return () => clearTimeout(t);
  }, [added, onDone]);

  const unit = useMemo(() => unitPriceCents(item, selections), [item, selections]);

  function toggle(groupId: string, choiceId: string, type: "single" | "multi") {
    setSelections((s) => {
      const cur = s[groupId] ?? [];
      if (type === "single") return { ...s, [groupId]: [choiceId] };
      return { ...s, [groupId]: cur.includes(choiceId) ? cur.filter((c) => c !== choiceId) : [...cur, choiceId] };
    });
  }

  function add() {
    cart.addLine({
      itemId: item.id,
      slug: item.slug,
      category: item.category,
      name: item.name,
      imageKey: item.image_key,
      quantity: qty,
      selections,
      removed,
      note: note.trim(),
      unitPriceCents: unit,
      summary: selectionSummary(item, selections, removed),
    });
    setAdded(true);
    toast.success(`${qty} × ${item.name} added to your bag`, {
      action: { label: "View bag", onClick: () => cart.setOpen(true) },
    });
  }

  return (
    <div className="flex max-h-[92vh] flex-col">
      <div className="overflow-y-auto">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <motion.img
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            src={foodImage(item.image_key)}
            alt={item.name}
            width={1024}
            height={1024}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-6 p-6">
          <div>
            <DialogTitle className="font-display text-3xl font-black uppercase">{item.name}</DialogTitle>
            <DialogDescription className="mt-2 text-base text-charcoal/75">{item.description}</DialogDescription>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" /> {item.calories} cal · from {formatMoney(item.price_cents)}
            </p>
          </div>

          {item.options.map((g) => (
            <fieldset key={g.id}>
              <legend className="flex w-full items-center justify-between">
                <span className="font-display text-sm font-black tracking-wider uppercase">{g.label}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {g.required ? "Required" : g.type === "multi" ? "Pick any" : "Optional"}
                </span>
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {g.choices.map((c) => {
                  const on = (selections[g.id] ?? []).includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggle(g.id, c.id, g.type)}
                      aria-pressed={on}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.98]",
                        on ? "border-primary shadow-chunky" : "border-transparent hover:border-border",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center border-2 transition",
                            g.type === "single" ? "rounded-full" : "rounded-md",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                          )}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {c.label}
                      </span>
                      {c.price_cents > 0 && <span className="text-muted-foreground tabular-nums">+{formatMoney(c.price_cents)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {item.ingredients.length > 0 && (
            <fieldset>
              <legend className="flex w-full items-center justify-between">
                <span className="font-display text-sm font-black tracking-wider uppercase">What's inside</span>
                <span className="text-xs font-semibold text-muted-foreground">Tap to hold</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.ingredients.map((ing) => {
                  const off = removed.includes(ing);
                  return (
                    <button
                      type="button"
                      key={ing}
                      onClick={() => setRemoved((r) => (off ? r.filter((x) => x !== ing) : [...r, ing]))}
                      aria-pressed={off}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95",
                        off ? "bg-muted text-muted-foreground line-through" : "bg-card text-charcoal shadow-card",
                      )}
                    >
                      <Leaf className={cn("h-3.5 w-3.5", off ? "opacity-40" : "text-success")} />
                      {ing}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="item-note" className="font-display text-sm font-black tracking-wider uppercase">
              Notes for the kitchen
            </label>
            <input
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 140))}
              placeholder="e.g. Extra crispy, cut in half"
              className="mt-2 h-11 w-full rounded-xl border-2 border-input bg-card px-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t bg-card p-4 sm:px-6">
        <QuantityStepper value={qty} onChange={setQty} />
        <Button variant="hero" size="xl" className="flex-1" onClick={add} disabled={!item.is_available || added}>
          <AnimatePresence mode="wait" initial={false}>
            {added ? (
              <motion.span key="done" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-2">
                <Check className="h-5 w-5" /> In your bag
              </motion.span>
            ) : (
              <motion.span key="add" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                {item.is_available ? `Add to bag · ${formatMoney(unit * qty)}` : "Sold out today"}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
