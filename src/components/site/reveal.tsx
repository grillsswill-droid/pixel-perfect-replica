import type { ReactNode } from "react";

// SiteMotion adds one-shot reveals after hydration; SSR content stays visible.
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className} data-reveal data-reveal-delay={delay * 1000}>{children}</div>;
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className} data-reveal>{children}</div>;
}
