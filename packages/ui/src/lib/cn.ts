import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merge. Presentation only. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
