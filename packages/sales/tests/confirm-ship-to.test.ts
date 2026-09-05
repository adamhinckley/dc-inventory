import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import {
  CustomerId,
  LocationId,
  Money,
  OrganizationId,
  ProductId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCatalogProductPort } from "../src/adapters/in-memory-catalog-product-port.js";
import { InMemoryCustomerShipToSnapshotReadPort } from "../src/adapters/in-memory-customer-ship-to-snapshot-read.js";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import { ConfirmSalesOrderUseCase, CreateSalesOrderUseCase } from "../src/index.js";
import {
  testShipBillToSnapshot,
  testShipCustomerTerms,
} from "./support/ship-invoice-readports.js";
import {
  seedTestShipTo,
  TEST_SHIP_TO_ID,
  TEST_SHIP_TO_SNAPSHOT,
} from "./support/test-ship-to.js";

const SKU = Sku.parse("CONFIRM-SHIP-SKU");
const PRODUCT_ID = ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const OTHER_CUSTOMER_ID = CustomerId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const OTHER_SHIP_TO_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MISSING_SHIP_TO_ID = "99999999-9999-4999-8999-999999999999";

async function harness() {
  const uow = new InMemorySalesUnitOfWork(testShipBillToSnapshot, testShipCustomerTerms);
  const shipToSnapshot = new InMemoryCustomerShipToSnapshotReadPort();
  seedTestShipTo(shipToSnapshot, CUSTOMER_ID);
  const customers = {
    findById: async (organizationId: OrganizationId, id: CustomerId) =>
      organizationId === DEFAULT_ORG && id === CUSTOMER_ID
        ? { id, accountStatus: "active" as const }
        : null,
  };
  const catalog = new InMemoryCatalogProductPort([
    {
      productId: PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: SKU,
      name: "Widget",
      unitPrice: Money.fromMinorUnits(500, "USD"),
      active: true,
    },
  ]);

  return {
    uow,
    create: new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog),
    confirm: new ConfirmSalesOrderUseCase(uow, customers, shipToSnapshot),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(uow.ledger),
    shipToId: TEST_SHIP_TO_ID,
    shipToSnapshot,
  };
}

describe("Confirm sales order ship-to (ADA-292)", () => {
  it("snapshots six ship-to fields on confirm", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 2 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ship-to-snapshot",
      shipToId: h.shipToId,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.salesOrder).toMatchObject({
      status: "confirmed",
      shipLine1: TEST_SHIP_TO_SNAPSHOT.line1,
      shipLine2: TEST_SHIP_TO_SNAPSHOT.line2,
      shipCity: TEST_SHIP_TO_SNAPSHOT.city,
      shipRegion: TEST_SHIP_TO_SNAPSHOT.region,
      shipPostal: TEST_SHIP_TO_SNAPSHOT.postal,
      shipCountry: TEST_SHIP_TO_SNAPSHOT.country,
    });
  });

  it("fails when ship-to belongs to another customer", async () => {
    const h = await harness();
    h.shipToSnapshot.seed(OTHER_CUSTOMER_ID, OTHER_SHIP_TO_ID, {
      line1: "300 Other St",
      line2: null,
      city: "Portland",
      region: "OR",
      postal: "97201",
      country: "US",
    });
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const failed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-cross-customer-ship-to",
      shipToId: OTHER_SHIP_TO_ID,
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) {
      return;
    }
    expect(failed.reason).toBe("ship_to_not_found");

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.status).toBe("draft");
  });

  it("fails when ship-to is missing", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const failed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-missing-ship-to",
      shipToId: MISSING_SHIP_TO_ID,
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) {
      return;
    }
    expect(failed.reason).toBe("ship_to_not_found");

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.status).toBe("draft");
  });

  it("retries confirm with the same idempotency key after success", async () => {
    const h = await harness();
    await h.uow.run(async () => {
      const seeded = await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "confirm-retry-seed",
        sku: SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "confirm-retry-seed",
      });
      expect(seeded.ok).toBe(true);
    });

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 3 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ship-to-retry",
      shipToId: h.shipToId,
    });
    expect(first.ok).toBe(true);

    const retry = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ship-to-retry",
      shipToId: h.shipToId,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok || !first.ok) {
      return;
    }
    expect(retry.salesOrder.id).toBe(first.salesOrder.id);
    expect(retry.salesOrder.status).toBe("confirmed");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.committed).toBe(3);
  });
});
