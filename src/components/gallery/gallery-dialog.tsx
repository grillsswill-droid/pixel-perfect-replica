import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { KeyboardEventHandler, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function GalleryDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  onCloseAutoFocus,
  onKeyDown,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  className?: string;
  onCloseAutoFocus?: (event: Event) => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/85" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          onKeyDown={onKeyDown}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card p-5 shadow-card sm:p-6",
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          {children}
          <Dialog.Close className="absolute right-3 top-3 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-charcoal text-white transition-colors hover:bg-charcoal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
