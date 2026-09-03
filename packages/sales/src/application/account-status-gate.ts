import type { AccountStatus } from "@dc-inventory/customers";

export type AccountStatusGateReason = "customer_on_hold" | "customer_inactive";

export type SalesOrderActor = "staff" | "wholesale";

export function createDraftAccountStatusGate(
  accountStatus: AccountStatus,
  actor: SalesOrderActor,
): AccountStatusGateReason | null {
  if (accountStatus === "inactive") {
    return "customer_inactive";
  }
  if (accountStatus === "on_hold" && actor === "staff") {
    return "customer_on_hold";
  }
  return null;
}

export function confirmAccountStatusGate(
  accountStatus: AccountStatus,
): AccountStatusGateReason | null {
  if (accountStatus === "inactive") {
    return "customer_inactive";
  }
  if (accountStatus === "on_hold") {
    return "customer_on_hold";
  }
  return null;
}
