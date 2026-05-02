import * as React from "react";

import { cn } from "./utils";

/** Minimal shadcn-style text input primitive. */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
        className,
      )}
      {...props}
    />
  );
}
