import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-(--space-input-height) w-full rounded-interactable border border-border-field bg-surface-card px-input-x py-input-y text-input text-fg placeholder:text-placeholder hover:border-border-field-hover focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
