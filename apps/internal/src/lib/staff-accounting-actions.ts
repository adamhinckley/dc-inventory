import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import { staffRolesFromSession, type StaffSessionRole } from "./customer-types";

/** Mirrors G8 / staff-action-policy.ts (admin | accounting). */
const PAYMENTS_APPLY_ROLES = new Set<StaffSessionRole>(["admin", "accounting"]);
const AR_ADJUST_ROLES = new Set<StaffSessionRole>(["admin", "accounting"]);
const PAYMENT_PLANS_MANAGE_ROLES = new Set<StaffSessionRole>(["admin", "accounting"]);

export function canApplyPayments(roles: readonly StaffSessionRole[]): boolean {
  return roles.some((role) => PAYMENTS_APPLY_ROLES.has(role));
}

export function canArAdjust(roles: readonly StaffSessionRole[]): boolean {
  return roles.some((role) => AR_ADJUST_ROLES.has(role));
}

export function canManagePaymentPlans(roles: readonly StaffSessionRole[]): boolean {
  return roles.some((role) => PAYMENT_PLANS_MANAGE_ROLES.has(role));
}

export function useStaffAccountingActions() {
  const sessionQuery = useGetInternalSession();
  const session =
    sessionQuery.data?.status === 200 ? sessionQuery.data.data : undefined;
  const roles = staffRolesFromSession(session);

  return {
    canApplyPayments: canApplyPayments(roles),
    canArAdjust: canArAdjust(roles),
    canManagePaymentPlans: canManagePaymentPlans(roles),
  };
}
