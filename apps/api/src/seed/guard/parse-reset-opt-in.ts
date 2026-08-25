/**
 * Only trimmed `DEMO_SEED_RESET=1` authorizes a scoped wipe.
 */
export function isDemoSeedResetOptIn(value: string | undefined): boolean {
  return value?.trim() === "1";
}
