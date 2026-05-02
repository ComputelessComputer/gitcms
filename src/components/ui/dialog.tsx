import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "./button";
import { cn } from "./utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Dialog content with overlay and close affordance. */
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>): React.ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button className="absolute right-3 top-3" size="icon" variant="ghost" aria-label="Close">
            <XIcon className="size-4" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Dialog title primitive. */
export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): React.ReactElement {
  return <DialogPrimitive.Title className={cn("text-base font-semibold", className)} {...props} />;
}

/** Dialog description primitive. */
export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): React.ReactElement {
  return (
    <DialogPrimitive.Description className={cn("text-sm text-slate-500", className)} {...props} />
  );
}
