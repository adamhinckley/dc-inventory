import { describe, expect, it } from "vitest";
import { GetSalesOrderByDocumentNumberUseCase } from "../src/application/get-sales-order-by-document-number.js";
import {
  CUSTOMER_ID,
  DEFAULT_ORG,
  OPEN_PRODUCT_ID,
  STAFF_ID,
  salesDemandHarness,
} from "./support/sales-demand-harness.js";

describe("GetSalesOrderByDocumentNumberUseCase", () => {
  it("returns the order for an exact document number", async () => {
    const h = salesDemandHarness();
    const created = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 1);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const stored = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrderId);
    expect(stored).not.toBeNull();
    if (stored === null) {
      return;
    }

    const get = new GetSalesOrderByDocumentNumberUseCase(h.uow.salesOrders);
    const found = await get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      documentNumber: stored.documentNumber,
    });
    expect(found.ok).toBe(true);
    if (!found.ok) {
      return;
    }
    expect(found.salesOrder.id).toBe(created.salesOrderId);
    expect(found.salesOrder.customerId).toBe(CUSTOMER_ID);
    expect(found.salesOrder.documentNumber).toBe(stored.documentNumber);
  });

  it("returns not_found when the document number is missing", async () => {
    const h = salesDemandHarness();
    const get = new GetSalesOrderByDocumentNumberUseCase(h.uow.salesOrders);
    const missing = await get.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      documentNumber: "SO-99999",
    });
    expect(missing).toEqual({ ok: false, reason: "not_found" });
  });
});
