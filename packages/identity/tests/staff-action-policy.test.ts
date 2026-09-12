import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  STAFF_ACTIONS,
  canStaffPerform,
  type StaffAction,
} from "../src/application/staff-action-policy.js";
import { STAFF_ROLES, type StaffRole } from "../src/domain/staff-role.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

/** Mirrors docs/invariants.md G8 (amended 2026-09-08). */
const EXPECTED: Readonly<Record<StaffAction, readonly StaffRole[]>> = {
  master_data_manage: ["admin", "purchasing"],
  purchase_orders_manage: ["admin", "purchasing"],
  stock_manage: ["admin", "warehouse"],
  sales_orders_manage: ["admin", "sales_support"],
  payments_apply: ["admin", "accounting"],
  ar_adjust: ["admin", "accounting"],
  payment_plans_manage: ["admin", "accounting"],
  credit_limit_manage: ["admin", "accounting"],
  organizations_manage: ["admin"],
};

describe("static staff action policy", () => {
  it.each(STAFF_ACTIONS.filter((action) => action !== "organizations_manage"))(
    "matches the G8 role matrix for %s",
    (action) => {
      for (const role of STAFF_ROLES) {
        expect(canStaffPerform([role], action), `${role} on ${action}`).toBe(
          EXPECTED[action].includes(role),
        );
      }
    },
  );

  it("allows any granting role and denies an empty role set", () => {
    expect(canStaffPerform(["warehouse", "purchasing"], "stock_manage")).toBe(true);
    expect(canStaffPerform([], "stock_manage")).toBe(false);
  });

  it("grants accounting-only staff all AR actions", () => {
    const arActions: StaffAction[] = [
      "payments_apply",
      "ar_adjust",
      "payment_plans_manage",
      "credit_limit_manage",
    ];
    for (const action of arActions) {
      expect(canStaffPerform(["accounting"], action), `accounting on ${action}`).toBe(true);
    }
    expect(canStaffPerform(["accounting"], "master_data_manage")).toBe(false);
  });

  it("grants organizations_manage only to DEFAULT platform admins", () => {
    const defaultAdmin = { organizationId: OrganizationId.DEFAULT };
    expect(canStaffPerform(["admin"], "organizations_manage", defaultAdmin)).toBe(true);
    expect(canStaffPerform(["purchasing"], "organizations_manage", defaultAdmin)).toBe(false);
    expect(canStaffPerform(["admin"], "organizations_manage", { organizationId: BETA_ORG })).toBe(
      false,
    );
    expect(canStaffPerform(["admin"], "organizations_manage")).toBe(false);
  });
});
