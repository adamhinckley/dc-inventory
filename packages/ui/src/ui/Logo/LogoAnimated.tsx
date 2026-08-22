"use client";

import { cn } from "#cn";

export interface LogoAnimatedProps {
  expanded: boolean;
  className?: string;
}

export function LogoAnimated({ expanded, className }: LogoAnimatedProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold tracking-tight text-fg",
        expanded ? "text-title-sm" : "text-label",
        className,
      )}
    >
      {expanded ? "DC Internal" : "DC"}
    </span>
  );
}
