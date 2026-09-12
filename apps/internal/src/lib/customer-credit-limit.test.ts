import { describe, expect, it } from "vitest";
import {
  STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS,
  STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_DOLLARS,
  centsToWholeDollars,
  wholeDollarsToCents,
} from "./customer-credit-limit.js";

describe("customer credit limit dollars", () => {
  it("treats the staff-for-them default as $10,000, not 1,000,000 dollars", () => {
    expect(STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS).toBe(1_000_000);
    expect(STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_DOLLARS).toBe(10_000);
    expect(centsToWholeDollars(1_000_000)).toBe(10_000);
    expect(wholeDollarsToCents(10_000)).toBe(1_000_000);
  });
});
