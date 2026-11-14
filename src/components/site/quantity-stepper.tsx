import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "grid place-items-center rounded-full bg-card text-charcoal transition active:scale-90 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:pointer-events-none",
    size === "sm" ? "h-7 w-7" : "h-9 w-9",
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min - (min === 0 ? 0 : 0) && value <= min} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className={cn("min-w-7 text-center font-display font-bold tabular-nums", size === "sm" ? "text-sm" : "text-base")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
