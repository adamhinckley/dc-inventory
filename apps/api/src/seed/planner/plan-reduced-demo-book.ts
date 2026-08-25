import {
  DEFAULT_DEMO_SEED,
  REDUCED_DEMO_COUNTS,
  REDUCED_PERSONA_ORDER_BUDGETS,
  type DemoCounts,
} from "./constants.js";
import { planDemoBook } from "./plan-demo-book.js";
import type { DemoBookPlan } from "./types.js";

/** Playback-sized counts for in-memory orchestration tests (not the hand-built reconciliation book). */
export const REDUCED_PLAYBACK_COUNTS: DemoCounts = {
  ...REDUCED_DEMO_COUNTS,
  shippedSalesOrders: 8,
  invoices: 8,
  // Idle Park ships all four persona-budget orders unpaid; one mix invoice is also unpaid.
  payments: 3,
  unpaidInvoices: 5,
  mixUnpaidInvoices: 1,
  leftoverConfirmedPurchaseOrderMin: 0,
  leftoverConfirmedPurchaseOrderMax: 0,
  leftoverConfirmedSalesOrderMin: 0,
  leftoverConfirmedSalesOrderMax: 0,
};

/** Test-only reduced planner. Not exported from the public planner index or CLI. */
export function planReducedDemoBook(seedToday: Date): DemoBookPlan {
  return planDemoBook({
    seed: DEFAULT_DEMO_SEED,
    seedToday,
    counts: REDUCED_PLAYBACK_COUNTS,
    personaOrderBudgets: REDUCED_PERSONA_ORDER_BUDGETS,
  });
}
