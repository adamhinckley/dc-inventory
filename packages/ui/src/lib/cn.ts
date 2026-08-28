import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Type-scale `@utility text-*` classes in globals.css. Without this, tailwind-merge
 * treats them as colors, so `text-button` + `text-primary-content` collapse.
 */
const typeScale = [
  "display",
  "title-lg",
  "title-md",
  "title-base",
  "title-sm",
  "title-xs",
  "body",
  "body-emphasis",
  "body-sm",
  "label",
  "button",
  "input",
  "caption",
  "overline",
  "badge",
  "code",
  "2xs",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...typeScale] }],
    },
  },
});

/** shadcn-style class merge. Presentation only. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
