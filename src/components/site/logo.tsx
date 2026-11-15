import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="Grill & Swill home"
    >
      <img
        src="/favicon.png"
        alt=""
        className="h-10 w-10 shrink-0 object-contain transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
      />
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
