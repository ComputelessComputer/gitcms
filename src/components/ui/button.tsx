import * as React from "react";

import { cn } from "./utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual button style. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Button size. */
  size?: "sm" | "md" | "icon";
}

/** Minimal shadcn-style button primitive. */
export function Button({
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
        variant === "secondary" && "border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
        variant === "ghost" && "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
        variant === "danger" && "border-red-600 bg-red-600 text-white hover:bg-red-700",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "size-9 p-0",
        className,
      )}
      {...props}
    />
  );
}
