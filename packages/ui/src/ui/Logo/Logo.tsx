"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "#cn";

export interface LogoProps extends ComponentPropsWithRef<"span"> {
  variant: "full" | "mark";
}

export function Logo({ variant, className, ...rest }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold tracking-tight text-fg",
        variant === "full" ? "text-title-sm" : "text-label",
        className,
      )}
      {...rest}
    >
      {variant === "full" ? "DC Internal" : "DC"}
    </span>
  );
}
