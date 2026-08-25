import type { DemoBookPlan, ReplayComparablePlan } from "./types.js";

function stripInstant<T extends { plannedInstant: Date }>(
  rows: readonly T[],
): Array<Omit<T, "plannedInstant"> & { plannedInstant: null }> {
  return rows.map((row) => ({
    ...row,
    plannedInstant: null,
  }));
}

export function toReplayComparablePlan(plan: DemoBookPlan): ReplayComparablePlan {
  return {
    seed: plan.seed,
    master: plan.master,
    purchaseOrders: stripInstant(plan.purchaseOrders),
    salesOrders: stripInstant(plan.salesOrders),
    shippedInvoices: stripInstant(plan.shippedInvoices),
    leftoverConfirmedPurchaseOrderCount: plan.leftoverConfirmedPurchaseOrderCount,
    leftoverConfirmedSalesOrderCount: plan.leftoverConfirmedSalesOrderCount,
  };
}

export function replayEqual(left: ReplayComparablePlan, right: ReplayComparablePlan): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeys(entry));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}

export function replayFingerprint(plan: DemoBookPlan): string {
  return stableStringify(toReplayComparablePlan(plan));
}
