import type { ReactNode } from "react";

/**
 * Content must remain visible in the server-rendered document. The previous
 * whileInView implementation emitted `opacity: 0` during SSR; on streamed
 * Vercel pages that could leave whole sections invisible until an observer
 * happened to fire, producing large blank areas. The homepage already has an
 * authored hero motion moment, so section content uses a resilient static
 * wrapper instead of hiding essential content behind hydration.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
