import { describe, expect, it } from "vitest";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { DEMO_SEED_ORGANIZATION_ID } from "./demo-seed-organization.js";
import { planReducedDemoBook, REDUCED_PLAYBACK_COUNTS } from "./planner/plan-reduced-demo-book.js";
import { REDUCED_DEMO_RECONCILIATION_EXPECTATIONS } from "./reconciliation/valid-reduced-demo-book.js";
import { runDemoSeedInMemory } from "./run-demo-seed.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");

const REDUCED_PLAYBACK_EXPECTATIONS = {
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
};

describe("runDemoSeedInMemory", () => {
  it("replays a reduced test-only plan through real use cases and passes reconciliation", async () => {
    const plan = planReducedDemoBook(SEED_TODAY);

    const result = await runDemoSeedInMemory({
      plan,
      secrets: {
        staffPassword: "staff-placeholder",
        wholesalePassword: "wholesale-placeholder",
      },
      expectations: REDUCED_PLAYBACK_EXPECTATIONS,
    });

    expect(result.reconciliation.ok).toBe(true);
    expect(result.defaultLocationId.length).toBeGreaterThan(0);
    expect(DEMO_SEED_ORGANIZATION_ID).toBe(OrganizationId.DEFAULT);
  });
});
