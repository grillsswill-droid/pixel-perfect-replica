import { Plus } from "lucide-react";

import { foodImage } from "@/lib/food-images";
import type { MenuItem } from "@/lib/menu-types";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function MenuCard({
  item,
  onSelect,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}) {
  const imageSrc = foodImage(item.image_key);
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      data-testid="menu-card"
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-3xl bg-card text-left shadow-card transition duration-300 hover:-translate-y-1.5 hover:shadow-lift active:scale-[0.98]",
        !item.is_available && "opacity-70",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            width={1024}
            height={1024}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
          />
        ) : null}
        {item.tags[0] && (
          <span className="absolute top-3 left-3 rounded-full bg-charcoal px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-cream uppercase">
            {item.tags[0]}
          </span>
        )}
        {!item.is_available && (
          <span className="absolute inset-0 grid place-items-center bg-charcoal/55">
            <span className="font-display -rotate-6 rounded-lg bg-cream px-4 py-2 text-lg font-black text-charcoal uppercase">
              Sold out
            </span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-tight font-black uppercase">{item.name}</h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {item.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="font-display text-xl font-black tabular-nums">
              {formatMoney(item.price_cents)}
            </span>
            {item.calories > 0 ? (
              <span className="ml-2 text-xs font-semibold text-muted-foreground">
                {item.calories} cal
              </span>
            ) : null}
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:rotate-90 group-hover:bg-ember">
            <Plus className="h-5 w-5" />
          </span>
        </div>
      </div>
    </button>
  );
}
