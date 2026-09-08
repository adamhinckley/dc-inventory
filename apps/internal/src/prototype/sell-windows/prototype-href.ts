const PROTOTYPE_VARIANT = "C";

export function isSellWindowsPrototypeVariant(value: string | null | undefined): boolean {
  return value === "A" || value === "B" || value === "C";
}

/** Preserve prototype gate param on reopen sub-routes. */
export function sellWindowsPrototypeHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${normalized}?variant=${PROTOTYPE_VARIANT}`;
}

export { PROTOTYPE_VARIANT };
