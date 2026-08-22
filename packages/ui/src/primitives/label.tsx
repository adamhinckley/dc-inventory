import type { LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-sm font-medium text-primary", className)}
      {...props}
    />
  );
}
