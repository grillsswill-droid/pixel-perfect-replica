import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/grill-swill-logo.png.asset.json";
import { cn } from "@/lib/utils";

export const LOGO_URL = logoAsset.url;

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)} aria-label="Grill & Swill home">
      <img
        src={logoAsset.url}
        alt=""
        width={478}
        height={540}
        className="h-10 w-auto transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
      />
      <span className={cn("font-display text-lg leading-none font-black uppercase", light ? "text-cream" : "text-charcoal")}>
        Grill<span className="text-primary">&</span>Swill
      </span>
    </Link>
  );
}
