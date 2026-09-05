import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import {
  CustomerId,
  LocationId,
  Money,
  OrganizationId,
  OrderId,
  ProductId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemorySalesUnitOfWork } from "../src/adapters/in-memory-sales-unit-of-work.js";
import { InMemoryCatalogProductPort } from "../src/adapters/in-memory-catalog-product-port.js";
import { InMemoryCustomerShipToSnapshotReadPort } from "../src/adapters/in-memory-customer-ship-to-snapshot-read.js";
import {
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  ListSalesOrdersUseCase,
  ShipSalesOrderUseCase,
  type ICustomerBillToSnapshotReadPort,
} from "../src/index.js";
import { newUuid, SalesOrderLineId } from "../src/domain/ids.js";
import type { ISalesUnitOfWork } from "../src/domain/ports/sales-order-repository.js";
import {
  testShipBillToSnapshot,
  testShipCustomerTerms,
} from "./support/ship-invoice-readports.js";
import { seedTestShipTo, TEST_SHIP_TO_ID } from "./support/test-ship-to.js";

const SKU = Sku.parse("SO-TEST-SKU");
const SKU_B = Sku.parse("SO-TEST-SKU-B");
const PRODUCT_ID = ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const PRODUCT_ID_B = ProductId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
const INACTIVE_PRODUCT_ID = ProductId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
const BETA_PRODUCT_ID = ProductId.parse("ffffffff-ffff-4fff-8fff-ffffffffffff");
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const BETA_CUSTOMER_ID = CustomerId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

const billToSnapshot: ICustomerBillToSnapshotReadPort = {
  getBillToAddressSnapshot: async () => ({
    line1: "100 Main St",
    line2: null,
    city: "Portland",
    region: "OR",
    postal: "97201",
    country: "US",
  }),
};

async function harness() {
  const uow = new InMemorySalesUnitOfWork(testShipBillToSnapshot, testShipCustomerTerms);
  const shipToSnapshot = new InMemoryCustomerShipToSnapshotReadPort();
  seedTestShipTo(shipToSnapshot, CUSTOMER_ID);
  const customers = {
    findById: async (organizationId: OrganizationId, id: CustomerId) => {
      if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
        return { id, accountStatus: "active" as const };
      }
      if (organizationId === BETA_ORG && id === BETA_CUSTOMER_ID) {
        return { id, accountStatus: "active" as const };
      }
      return null;
    },
  };
  const catalog = new InMemoryCatalogProductPort([
    {
      productId: PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: SKU,
      name: "Catalog widget",
      unitPrice: Money.fromMinorUnits(500, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
    {
      productId: PRODUCT_ID_B,
      organizationId: DEFAULT_ORG,
      sku: SKU_B,
      name: "Catalog gadget",
      unitPrice: Money.fromMinorUnits(700, "USD"),
      active: true,
    },
    {
      productId: INACTIVE_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: Sku.parse("INACTIVE-SKU"),
      name: "Inactive product",
      unitPrice: Money.fromMinorUnits(900, "USD"),
      active: false,
    },
    {
      productId: BETA_PRODUCT_ID,
      organizationId: BETA_ORG,
      sku: Sku.parse("BETA-SKU"),
      name: "Beta product",
      unitPrice: Money.fromMinorUnits(1000, "USD"),
      active: true,
    },
  ]);

  return {
    uow,
    customers,
    create: new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog),
    list: new ListSalesOrdersUseCase(uow.salesOrders),
    confirm: new ConfirmSalesOrderUseCase(uow, customers, shipToSnapshot),
    cancel: new CancelSalesOrderUseCase(uow),
    ship: new ShipSalesOrderUseCase(uow, billToSnapshot),
    snapshot: new GetStockSnapshotUseCase(uow.inventoryReadModel),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(uow.ledger),
    shipToId: TEST_SHIP_TO_ID,
  };
}

async function seedStock(
  h: Awaited<ReturnType<typeof harness>>,
  sku: Sku,
  quantity: number,
) {
  await h.uow.run(async () => {
    const result = await h.adjustmentIncrease.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: `seed-${sku.value}-${quantity}`,
      sku,
      quantity,
      refType: "adjustment",
      refId: `seed-${sku.value}`,
    });
    expect(result.ok).toBe(true);
  });
}

describe("Sales (in-memory)", () => {
  it("assigns SO-00001 document numbers with gaps allowed after cancel", async () => {
    const h = await harness();
    const first = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 2 }],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.salesOrder.documentNumber).toBe("SO-00001");

    await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: first.salesOrder.id,
      idempotencyKey: "cancel-draft",
    });

    const second = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 1 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.salesOrder.documentNumber).toBe("SO-00002");

    const sorted = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "status",
      sortOrder: "asc",
    });
    expect(sorted.items.map((order) => order.status)).toEqual(["cancelled", "draft"]);

    const searched = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      q: "00002",
      page: 1,
      pageSize: 25,
      sortBy: "documentNumber",
      sortOrder: "desc",
      status: "draft",
      customerId: CUSTOMER_ID,
    });
    expect(searched.items.map((order) => order.documentNumber)).toEqual(["SO-00002"]);
  });

  it("merges duplicate product lines at create", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: PRODUCT_ID, qty: 2 },
        { productId: PRODUCT_ID, qty: 3 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.salesOrder.lines).toHaveLength(1);
    expect(created.salesOrder.lines[0]?.qty).toBe(5);
  });

  it("freezes authoritative Catalog fields on each line", async () => {
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
    expect(created.salesOrder.lines[0]).toMatchObject({
      sku: SKU,
      name: "Catalog widget",
      qty: 2,
      taxCategoryCode: "TANGIBLE",
    });
    expect(created.salesOrder.lines[0]?.unitPrice.amountMinor).toBe(500);
    expect(created.salesOrder.lines[0]?.unitPrice.currency).toBe("USD");
  });

  it.each([
    {
      productId: ProductId.parse("99999999-9999-4999-8999-999999999999"),
      reason: "product_not_found",
    },
    { productId: INACTIVE_PRODUCT_ID, reason: "product_inactive" },
    {
      productId: BETA_PRODUCT_ID,
      reason: "product_organization_mismatch",
    },
  ] as const)("rejects Catalog product with $reason", async ({ productId, reason }) => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId, qty: 1 }],
    });

    expect(created).toEqual({ ok: false, reason });
  });

  it("rejects empty orders and non-positive lines", async () => {
    const h = await harness();
    const empty = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [],
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      return;
    }
    expect(empty.reason).toBe("empty_order");

    const zero = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 0 }],
    });
    expect(zero.ok).toBe(false);
  });

  it("allows draft quantity over available", async () => {
    const h = await harness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 100 }],
    });
    expect(created.ok).toBe(true);
    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.available).toBe(0);
  });

  it("confirms with commit plus cover allocation per line", async () => {
    const h = await harness();
    await seedStock(h, SKU, 10);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: PRODUCT_ID, qty: 4 },
        { productId: PRODUCT_ID_B, qty: 3 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await seedStock(h, SKU_B, 2);

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-partial-cover",
      shipToId: h.shipToId,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.salesOrder.status).toBe("confirmed");

    const snapA = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snapA.committed).toBe(4);
    expect(snapA.allocated).toBe(4);
    expect(snapA.available).toBe(6);
    const snapB = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU_B, locationId: DEFAULT });
    expect(snapB.committed).toBe(3);
    expect(snapB.allocated).toBe(2);
    expect(snapB.available).toBe(0);
  });

  it("cancels confirmed orders with deallocation", async () => {
    const h = await harness();
    await seedStock(h, SKU, 8);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 5 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-cancel",
      shipToId: h.shipToId,
    });

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "cancel-confirmed",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    expect(cancelled.salesOrder.status).toBe("cancelled");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(0);
    expect(snap.available).toBe(8);
  });

  it("allows multiple open confirms that share warehouse leftover", async () => {
    const h = await harness();
    await seedStock(h, SKU, 5);

    const firstOrder = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 4 }],
    });
    expect(firstOrder.ok).toBe(true);
    if (!firstOrder.ok) {
      return;
    }

    const firstConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: firstOrder.salesOrder.id,
      idempotencyKey: "confirm-a",
      shipToId: h.shipToId,
    });
    expect(firstConfirm.ok).toBe(true);

    const secondOrder = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 4 }],
    });
    expect(secondOrder.ok).toBe(true);
    if (!secondOrder.ok) {
      return;
    }
    expect(secondOrder.salesOrder.id).not.toBe(firstOrder.salesOrder.id);

    const secondConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: secondOrder.salesOrder.id,
      idempotencyKey: "confirm-b",
      shipToId: h.shipToId,
    });
    expect(secondConfirm.ok).toBe(true);

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.committed).toBe(8);
    expect(snap.allocated).toBe(5);
    expect(snap.available).toBe(0);
  });

  it("ships confirmed orders atomically with zero-tax invoice", async () => {
    const h = await harness();
    await seedStock(h, SKU, 10);

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 4 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-ship",
      shipToId: h.shipToId,
    });

    const shipped = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-once",
    });
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) {
      return;
    }
    expect(shipped.salesOrder.status).toBe("shipped");

    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(0);
    expect(snap.onHand).toBe(6);
    expect(snap.available).toBe(6);

    const invoice = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.taxTotal.amountMinor).toBe(0);
    expect(invoice?.total.amountMinor).toBe(2000);
    expect(invoice?.subtotal.amountMinor).toBe(2000);
    expect(invoice?.documentNumber).toBe("INV-00001");
  });

  it("retrying ship does not duplicate invoice or shipment", async () => {
    const h = await harness();
    await seedStock(h, SKU, 5);

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

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-retry",
      shipToId: h.shipToId,
    });

    const first = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-retry",
    });
    expect(first.ok).toBe(true);

    const second = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-retry-again",
    });
    expect(second.ok).toBe(true);

    const invoices = await h.uow.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id);
    expect(invoices).not.toBeNull();
    const snap = await h.snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.onHand).toBe(3);
  });

  it("rejects cancel after ship", async () => {
    const h = await harness();
    await seedStock(h, SKU, 4);

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

    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "confirm-no-cancel",
      shipToId: h.shipToId,
    });
    await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "ship-no-cancel",
    });

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "cancel-after-ship",
    });
    expect(cancelled.ok).toBe(false);
    if (cancelled.ok) {
      return;
    }
    expect(cancelled.reason).toBe("illegal_transition");
  });

  it("rolls back ship when invoice creation fails", async () => {
    const base = new InMemorySalesUnitOfWork(testShipBillToSnapshot, testShipCustomerTerms);
    const failingAccounting: ISalesUnitOfWork["accounting"] = {
      createInvoiceForOrder: async () => ({ ok: false, reason: "invalid" }),
    };
    const failingUow: ISalesUnitOfWork = {
      salesOrders: base.salesOrders,
      inventory: base.inventory,
      accounting: failingAccounting,
      run: (work) => base.run(() => work(failingUow)),
    };

    const customers = {
      findById: async (organizationId: OrganizationId, id: CustomerId) => {
        if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
          return { id, accountStatus: "active" as const };
        }
        return null;
      },
    };
    const shipToSnapshot = new InMemoryCustomerShipToSnapshotReadPort();
    seedTestShipTo(shipToSnapshot, CUSTOMER_ID);
    const catalog = new InMemoryCatalogProductPort([
      {
        productId: PRODUCT_ID,
        organizationId: DEFAULT_ORG,
        sku: SKU,
        name: "Catalog widget",
        unitPrice: Money.fromMinorUnits(100, "USD"),
        active: true,
      },
    ]);
    const create = new CreateSalesOrderUseCase(
      failingUow.salesOrders,
      customers,
      catalog,
    );
    const confirm = new ConfirmSalesOrderUseCase(failingUow, customers, shipToSnapshot);
    const ship = new ShipSalesOrderUseCase(failingUow, billToSnapshot);
    const snapshot = new GetStockSnapshotUseCase(base.inventoryReadModel);
    const adjustmentIncrease = new RecordAdjustmentIncreaseUseCase(base.ledger);

    await base.run(async () => {
      await adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "rollback-seed",
        sku: SKU,
        quantity: 6,
        refType: "adjustment",
        refId: "rollback-seed",
      });
    });

    const created = await create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 3 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "rollback-confirm",
      shipToId: TEST_SHIP_TO_ID,
    });

    const result = await ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "rollback-ship",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("accounting_invalid");

    const reloaded = await failingUow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.status).toBe("confirmed");
    const snap = await snapshot.execute({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
    expect(snap.allocated).toBe(3);
    expect(snap.onHand).toBe(6);
    expect(await base.invoices.findByOrderId(DEFAULT_ORG, created.salesOrder.id)).toBeNull();
  });

  it("scopes sales orders by organizationId and rejects cross-org customers at create", async () => {
    const h = await harness();
    const acmeOrderId = OrderId.parse(newUuid());
    const betaOrderId = OrderId.parse(newUuid());
    const lineId = SalesOrderLineId.parse(newUuid());
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const unitPrice = Money.fromMinorUnits(500, "USD");

    await h.uow.salesOrders.save({
      id: acmeOrderId,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      documentNumber: "SO-1001",
      status: "draft",
      createdAt,
      lines: [{ id: lineId, sku: SKU, name: "Acme widget", qty: 2, unitPrice }],
    });
    await h.uow.salesOrders.save({
      id: betaOrderId,
      organizationId: BETA_ORG,
      customerId: BETA_CUSTOMER_ID,
      documentNumber: "SO-1001",
      status: "draft",
      createdAt,
      lines: [
        {
          id: SalesOrderLineId.parse(newUuid()),
          sku: SKU,
          name: "Beta widget",
          qty: 3,
          unitPrice,
        },
      ],
    });

    const acmeList = await h.list.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
    });
    expect(acmeList.total).toBe(1);
    expect(acmeList.items[0]?.documentNumber).toBe("SO-1001");
    expect(acmeList.items[0]?.id).toBe(acmeOrderId);

    const betaList = await h.list.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
    });
    expect(betaList.total).toBe(1);
    expect(betaList.items[0]?.id).toBe(betaOrderId);

    const crossOrgCreate = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: BETA_CUSTOMER_ID,
      lines: [{ productId: PRODUCT_ID, qty: 1 }],
    });
    expect(crossOrgCreate.ok).toBe(false);
    if (crossOrgCreate.ok) {
      return;
    }
    expect(crossOrgCreate.reason).toBe("customer_not_found");

    const crossOrgConfirm = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: betaOrderId,
      idempotencyKey: "confirm-beta-from-acme",
      shipToId: h.shipToId,
    });
    expect(crossOrgConfirm.ok).toBe(false);
    if (crossOrgConfirm.ok) {
      return;
    }
    expect(crossOrgConfirm.reason).toBe("not_found");
  });
});
