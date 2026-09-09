import { describe, expect, it } from "vitest";
import {
  canApplyPayments,
  canArAdjust,
  canManagePaymentPlans,
} from "./staff-accounting-actions";

describe("staff accounting actions", () => {
  it("allows payments_apply for admin and accounting only", () => {
    expect(canApplyPayments(["admin"])).toBe(true);
    expect(canApplyPayments(["accounting"])).toBe(true);
    expect(canApplyPayments(["purchasing"])).toBe(false);
    expect(canApplyPayments(["warehouse"])).toBe(false);
  });

  it("allows ar_adjust for admin and accounting only", () => {
    expect(canArAdjust(["admin"])).toBe(true);
    expect(canArAdjust(["accounting"])).toBe(true);
    expect(canArAdjust(["sales_support"])).toBe(false);
  });

  it("allows payment_plans_manage for admin and accounting only", () => {
    expect(canManagePaymentPlans(["admin"])).toBe(true);
    expect(canManagePaymentPlans(["accounting"])).toBe(true);
    expect(canManagePaymentPlans(["purchasing"])).toBe(false);
  });
});
