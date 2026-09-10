import {
  demoExpectationsWithSalesOrderDraftSpill,
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
} from "./reconciliation/expectations.js";
import {
  REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
} from "./reconciliation/valid-reduced-demo-book.js";
import type { DemoReconciliationExpectations } from "./reconciliation/expectations.js";
import type { DemoSeedProfile } from "./demo-seed-config.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import {
  planReducedDemoBook,
  REDUCED_PLAYBACK_COUNTS,
} from "./planner/plan-reduced-demo-book.js";
import type { DemoBookPlan } from "./planner/types.js";

const REDUCED_PLAYBACK_EXPECTATIONS: DemoReconciliationExpectations = {
  ...REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
  shippedSalesOrderCount: REDUCED_PLAYBACK_COUNTS.shippedSalesOrders,
  invoiceCount: REDUCED_PLAYBACK_COUNTS.invoices,
  paymentCount: REDUCED_PLAYBACK_COUNTS.payments,
  unpaidInvoiceCount: REDUCED_PLAYBACK_COUNTS.unpaidInvoices,
  salesOrderCount: REDUCED_PLAYBACK_COUNTS.salesOrders,
  purchaseOrderCount: REDUCED_PLAYBACK_COUNTS.purchaseOrders,
  leftoverConfirmedSalesOrderMin: 0,
  leftoverConfirmedSalesOrderMax: 0,
  leftoverConfirmedPurchaseOrderMin: 0,
  leftoverConfirmedPurchaseOrderMax: 0,
  lowStockMin: 2,
  lowStockMax: 8,
};

export function planCliDemoBook(input: {
  profile: DemoSeedProfile;
  seed: string;
  seedToday: Date;
}): { plan: DemoBookPlan; expectations: DemoReconciliationExpectations } {
  if (input.profile === "reduced") {
    const plan = planReducedDemoBook(input.seedToday);
    return {
      plan,
      expectations: demoExpectationsWithSalesOrderDraftSpill(
        REDUCED_PLAYBACK_EXPECTATIONS,
        plan.salesOrderDraftSpillToShipped,
      ),
    };
  }

  const plan = planDemoBook({ seed: input.seed, seedToday: input.seedToday });
  return {
    plan,
    expectations: demoExpectationsWithSalesOrderDraftSpill(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS,
      plan.salesOrderDraftSpillToShipped,
    ),
  };
}
