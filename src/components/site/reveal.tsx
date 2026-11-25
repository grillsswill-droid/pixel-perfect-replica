import type { ReactNode } from "react";

// SiteMotion adds one-shot reveals after hydration; SSR content stays visible.
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "rise",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "rise" | "left" | "right" | "scale" | "heading";
}) {
  return <div className={className} data-reveal={variant} data-reveal-delay={delay * 1000}>{children}</div>;
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className} data-reveal="scale">{children}</div>;
}
