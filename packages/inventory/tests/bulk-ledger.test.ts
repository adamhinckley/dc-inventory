import { LocationId, OrganizationId, PurchaseOrderId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryInventoryUnitOfWork } from "../src/index.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const DEFAULT = LocationId.DEFAULT;
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440030");
const SO_ID = "550e8400-e29b-41d4-a716-446655440040";

function lineSkus(count: number): Sku[] {
  return Array.from({ length: count }, (_, index) => Sku.parse(`BULK-SKU-${index + 1}`));
}

describe("bulk inventory ledger I/O", () => {
  it("uses bounded single-row record() calls for a 10-line inbound confirm bulk", async () => {
    const uow = new InMemoryInventoryUnitOfWork();
    const ledger = uow.ledger;
    const skus = lineSkus(10);

    ledger.resetSingleRecordCallCount();
    const bulkResult = await ledger.recordInboundFromPoBulk(
      skus.map((sku, index) => ({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `bulk-inbound:${index}`,
        sku,
        quantity: 5,
        refType: "purchase_order",
        refId: PO_ID,
      })),
    );
    expect(bulkResult.ok).toBe(true);
    expect(ledger.getSingleRecordCallCount()).toBe(0);

    ledger.resetSingleRecordCallCount();
    for (const [index, sku] of skus.entries()) {
      const result = await ledger.recordInboundFromPo({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `single-inbound:${index}`,
        sku,
        quantity: 3,
        refType: "purchase_order",
        refId: PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440031"),
      });
      expect(result.ok).toBe(true);
    }
    expect(ledger.getSingleRecordCallCount()).toBe(10);
  });

  it("uses bounded single-row record() calls for a 10-line sales commit bulk", async () => {
    const uow = new InMemoryInventoryUnitOfWork();
    const ledger = uow.ledger;
    const skus = lineSkus(10);

    ledger.resetSingleRecordCallCount();
    const bulkResult = await ledger.recordCommittedBulk(
      skus.map((sku, index) => ({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `bulk-commit:${index}`,
        sku,
        quantity: 2,
        refType: "sales_order",
        refId: SO_ID,
      })),
    );
    expect(bulkResult.ok).toBe(true);
    expect(ledger.getSingleRecordCallCount()).toBe(0);
  });

  it("writes the same snapshot totals for bulk and sequential inbound paths", async () => {
    const bulkUow = new InMemoryInventoryUnitOfWork();
    const sequentialUow = new InMemoryInventoryUnitOfWork();
    const skus = lineSkus(3);

    const bulkResult = await bulkUow.ledger.recordInboundFromPoBulk(
      skus.map((sku, index) => ({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `parity-bulk:${index}`,
        sku,
        quantity: 4,
        refType: "purchase_order",
        refId: PO_ID,
      })),
    );
    expect(bulkResult.ok).toBe(true);

    for (const [index, sku] of skus.entries()) {
      const result = await sequentialUow.ledger.recordInboundFromPo({
        organizationId: DEFAULT_ORG,
        idempotencyKey: `parity-single:${index}`,
        sku,
        quantity: 4,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(result.ok).toBe(true);
    }

    for (const sku of skus) {
      const bulkSnapshot = bulkUow.readModel.getSnapshotSync(sku, DEFAULT, DEFAULT_ORG);
      const sequentialSnapshot = sequentialUow.readModel.getSnapshotSync(
        sku,
        DEFAULT,
        DEFAULT_ORG,
      );
      expect(bulkSnapshot).toEqual(sequentialSnapshot);
    }
  });
});
