import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageIntro({
  title,
  description,
  actions,
  aside,
  tone = "cream",
  compact = false,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  tone?: "cream" | "charcoal";
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "page-intro",
        tone === "charcoal" ? "page-intro-dark" : "page-intro-light",
        compact && "page-intro-compact",
      )}
    >
      <div className="page-intro-inner mx-auto grid max-w-7xl items-end gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div data-reveal="heading" className="max-w-3xl">
          <h1 className="page-title font-display font-black uppercase">{title}</h1>
          <p className="page-description mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            {description}
          </p>
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? (
          <div data-reveal="right">{aside}</div>
        ) : (
          <div className="page-intro-mark" aria-hidden="true" data-reveal="scale">
            <img src="/favicon.png" alt="" width="96" height="96" />
          </div>
        )}
      </div>
    </section>
  );
}
