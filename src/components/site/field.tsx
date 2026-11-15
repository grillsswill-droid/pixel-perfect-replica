import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, id, className, ...props }, ref) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="text-xs font-bold tracking-wider text-charcoal/80 uppercase">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fieldId}-err` : undefined}
        className={cn(
          "mt-1.5 h-12 w-full rounded-xl border-2 bg-card px-4 text-base outline-none transition placeholder:text-muted-foreground/70 focus:border-primary",
          error ? "border-destructive" : "border-input",
        )}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-err`} className="mt-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
});
