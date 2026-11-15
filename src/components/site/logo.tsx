import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="Grill & Swill home"
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        <Shield className="h-10 w-10 fill-primary stroke-primary" strokeWidth={1.5} />
        <span className="font-display absolute text-[10px] font-black text-primary-foreground">
          G&amp;S
        </span>
      </span>
      <span
        className={cn(
          "font-display text-lg leading-none font-black uppercase",
          light ? "text-cream" : "text-charcoal",
        )}
      >
        Grill<span className="text-primary">&</span>Swill
      </span>
    </Link>
  );
}
