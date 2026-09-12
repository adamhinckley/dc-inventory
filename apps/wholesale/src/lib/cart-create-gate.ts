import type { WholesaleDraftCartOrder } from "./wholesale-cart-cache";

let createInFlight: Promise<WholesaleDraftCartOrder | null> | null = null;

/** One draft POST at a time; concurrent quick-adds await the same promise. */
export function runExclusiveDraftCreate(
  fn: () => Promise<WholesaleDraftCartOrder | null>,
): Promise<WholesaleDraftCartOrder | null> {
  if (createInFlight !== null) {
    return createInFlight;
  }
  createInFlight = fn().finally(() => {
    createInFlight = null;
  });
  return createInFlight;
}

/** Test-only reset. */
export function resetDraftCreateGate(): void {
  createInFlight = null;
}
