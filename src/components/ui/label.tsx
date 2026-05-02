import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "./utils";

/** Minimal shadcn-style label primitive. */
export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>): React.ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn("text-xs font-medium uppercase tracking-normal text-slate-500", className)}
      {...props}
    />
  );
}
