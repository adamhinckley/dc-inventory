/** Staff-for-them / approve default: $10,000 stored as minor units. */
export const STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS = 1_000_000;

export const STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_DOLLARS =
  STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS / 100;

export function centsToWholeDollars(cents: number): number {
  return cents / 100;
}

export function wholeDollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
