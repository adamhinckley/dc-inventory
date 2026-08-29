import { describe, expect, it } from "vitest";
import {
  STAFF_ACTIONS,
  canStaffPerform,
  type StaffAction,
} from "../src/application/staff-action-policy.js";
import type { StaffRole } from "../src/domain/staff-role.js";

const EXPECTED: Readonly<Record<StaffAction, readonly StaffRole[]>> = {
  master_data_manage: ["admin", "purchasing"],
  purchase_orders_manage: ["admin", "purchasing"],
  stock_manage: ["admin", "warehouse"],
  sales_orders_manage: ["admin", "sales_support"],
  payments_apply: ["admin"],
};

describe("static staff action policy", () => {
  it.each(STAFF_ACTIONS)("matches the G8 role matrix for %s", (action) => {
    for (const role of ["admin", "purchasing", "warehouse", "sales_support"] as const) {
      expect(canStaffPerform([role], action), `${role} on ${action}`).toBe(
        EXPECTED[action].includes(role),
      );
    }
  });

  it("allows any granting role and denies an empty role set", () => {
    expect(canStaffPerform(["warehouse", "purchasing"], "stock_manage")).toBe(true);
    expect(canStaffPerform([], "stock_manage")).toBe(false);
  });
});
