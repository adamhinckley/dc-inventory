import type { AccountStatus } from "@dc-inventory/customers";
import type { ICustomerAccountStatusReadPort } from "@dc-inventory/customers";
import {
  GetStockSnapshotUseCase,
  RecordAdjustmentIncreaseUseCase,
  RecordCommittedUseCase,
  RecordGoodsReceivedUseCase,
  RecordInboundCancelledUseCase,
  RecordInboundFromPoUseCase,
  type DemandStockFigures,
} from "@dc-inventory/inventory";
import {
  CustomerId,
  LocationId,
  Money,
  OrderId,
  OrganizationId,
  ProductId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { InMemoryCatalogProductPort } from "../../src/adapters/in-memory-catalog-product-port.js";
import { InMemoryCreditCheckPort } from "../../src/adapters/in-memory-credit-check.js";
import { InMemoryCustomerShipToSnapshotReadPort } from "../../src/adapters/in-memory-customer-ship-to-snapshot-read.js";
import { InMemorySalesUnitOfWork } from "../../src/adapters/in-memory-sales-unit-of-work.js";
import type { IClock } from "../../src/domain/clock.js";
import type { ICustomerLookupPort } from "../../src/domain/ports/sales-order-repository.js";
import {
  ApplySalesOrderLineDeltasUseCase,
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DecommitSalesOrderLineUseCase,
  ReplaceSalesOrderLinesUseCase,
  ShipSalesOrderUseCase,
  type BillToAddressSnapshot,
  type ICustomerBillToSnapshotReadPort,
} from "../../src/index.js";
import {
  testShipBillToSnapshot,
  testShipCustomerTerms,
} from "./ship-invoice-readports.js";
import { seedTestShipTo, TEST_SHIP_TO_ID } from "./test-ship-to.js";

export const DEFAULT_ORG = OrganizationId.DEFAULT;
export const DEFAULT_LOCATION = LocationId.DEFAULT;
export const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
export const WHOLESALE_USER_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
export const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

export const OPEN_SKU = Sku.parse("SALES-OPEN-1");
export const LOCK_SKU = Sku.parse("SALES-LOCK-1");
export const COVER_SKU = Sku.parse("SALES-COVER-1");

export const OPEN_PRODUCT_ID = ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
export const LOCK_PRODUCT_ID = ProductId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
export const COVER_PRODUCT_ID = ProductId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

export const PO_LOCK = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440050");
export const PO_COVER = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440051");

export const DEFAULT_BILL_TO: BillToAddressSnapshot = {
  line1: "100 Main St",
  line2: null,
  city: "Portland",
  region: "OR",
  postal: "97201",
  country: "US",
};

export type SalesDemandHarnessOptions = {
  billTo?: BillToAddressSnapshot | null;
  /** Read at operation time so tests can flip status after confirm. Defaults to active. */
  getAccountStatus?: () => AccountStatus;
};

export type SalesDemandHarness = ReturnType<typeof salesDemandHarness>;

export function salesDemandHarness(clock?: IClock, options: SalesDemandHarnessOptions = {}) {
  const resolveAccountStatus = options.getAccountStatus ?? (() => "active" as AccountStatus);
  const accountStatus: ICustomerAccountStatusReadPort = {
    getAccountStatus: async (organizationId, customerId) => {
      if (organizationId !== DEFAULT_ORG || customerId !== CUSTOMER_ID) {
        return null;
      }
      return resolveAccountStatus();
    },
  };

  const billToSnapshot: ICustomerBillToSnapshotReadPort = {
    getBillToAddressSnapshot: async (organizationId, customerId) => {
      if (organizationId !== DEFAULT_ORG || customerId !== CUSTOMER_ID) {
        return null;
      }
      if (options.billTo === null) {
        return null;
      }
      return options.billTo ?? DEFAULT_BILL_TO;
    },
  };

  const shipToSnapshot = new InMemoryCustomerShipToSnapshotReadPort();
  seedTestShipTo(shipToSnapshot, CUSTOMER_ID);

  const uow = new InMemorySalesUnitOfWork(billToSnapshot, testShipCustomerTerms, clock);
  const ledger = uow.ledger;
  const readModel = uow.inventoryReadModel;

  const customers: ICustomerLookupPort = {
    findById: async (organizationId, id) => {
      if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
        return null;
      }
      const status = await accountStatus.getAccountStatus(organizationId, id);
      if (status === null) {
        return null;
      }
      return { id, accountStatus: status };
    },
  };

  const catalog = new InMemoryCatalogProductPort([
    {
      productId: OPEN_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: OPEN_SKU,
      name: "Open presell widget",
      unitPrice: Money.fromMinorUnits(500, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
    {
      productId: LOCK_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: LOCK_SKU,
      name: "Locked presell widget",
      unitPrice: Money.fromMinorUnits(700, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
    {
      productId: COVER_PRODUCT_ID,
      organizationId: DEFAULT_ORG,
      sku: COVER_SKU,
      name: "Cover presell widget",
      unitPrice: Money.fromMinorUnits(900, "USD"),
      taxCategoryCode: "TANGIBLE",
      active: true,
    },
  ]);

  const creditCheck = new InMemoryCreditCheckPort();
  const create = new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog);
  const replaceLines = new ReplaceSalesOrderLinesUseCase(uow.salesOrders, customers, catalog);
  const applyLineDeltas = new ApplySalesOrderLineDeltasUseCase(uow.salesOrders, customers, catalog);
  const confirm = new ConfirmSalesOrderUseCase(uow, customers, shipToSnapshot, creditCheck);
  const cancel = new CancelSalesOrderUseCase(uow);
  const decommitLine = new DecommitSalesOrderLineUseCase(uow);
  const ship = new ShipSalesOrderUseCase(uow, billToSnapshot);
  const snapshot = new GetStockSnapshotUseCase(readModel);

  const inboundFromPo = new RecordInboundFromPoUseCase(ledger);
  const inboundCancelled = new RecordInboundCancelledUseCase(ledger);
  const adjustmentIncrease = new RecordAdjustmentIncreaseUseCase(ledger);
  const goodsReceived = new RecordGoodsReceivedUseCase(ledger);
  const committed = new RecordCommittedUseCase(ledger);

  async function demandSnapshot(
    sku: Sku,
    organizationId: OrganizationId = DEFAULT_ORG,
    locationId: LocationId = DEFAULT_LOCATION,
  ): Promise<DemandStockFigures> {
    return snapshot.execute({ organizationId, sku, locationId });
  }

  async function createStaffDraft(
    productId: ProductId,
    qty: number,
  ): Promise<{ ok: true; salesOrderId: OrderId } | { ok: false; reason: string }> {
    const result = await create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId, qty }],
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, salesOrderId: result.salesOrder.id };
  }

  async function createWholesaleDraft(
    productId: ProductId,
    qty: number,
  ): Promise<{ ok: true; salesOrderId: OrderId } | { ok: false; reason: string }> {
    const result = await create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId, qty }],
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, salesOrderId: result.salesOrder.id };
  }

  async function createStaffActingDraft(
    productId: ProductId,
    qty: number,
  ): Promise<{ ok: true; salesOrderId: OrderId } | { ok: false; reason: string }> {
    const result = await create.execute({
      organizationId: DEFAULT_ORG,
      placedByStaffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [{ productId, qty }],
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, salesOrderId: result.salesOrder.id };
  }

  /** Staff place-on-behalf — same as createStaffDraft. */
  const createDraft = createStaffDraft;

  return {
    uow,
    ledger,
    readModel,
    accountStatus,
    catalog,
    creditCheck,
    create,
    replaceLines,
    applyLineDeltas,
    confirm,
    cancel,
    decommitLine,
    ship,
    snapshot,
    inboundFromPo,
    inboundCancelled,
    adjustmentIncrease,
    goodsReceived,
    committed,
    demandSnapshot,
    createDraft,
    createStaffDraft,
    createWholesaleDraft,
    createStaffActingDraft,
    shipToId: TEST_SHIP_TO_ID,
  };
}

/** Sticky-lock a SKU with on_order 0, then seed on-hand (ADR 0008: lock without open PO qty). */
export async function seedStickyLockedOnHand(
  h: SalesDemandHarness,
  sku: Sku,
  onHand: number,
  poId: PurchaseOrderId,
  fixtureKey: string,
) {
  await h.inboundFromPo.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-inbound`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });
  await h.inboundCancelled.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-cancel`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });
  await h.adjustmentIncrease.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-on-hand`,
    sku,
    quantity: onHand,
    refType: "adjustment",
    refId: `${fixtureKey}-on-hand`,
  });
}

export async function seedOnHand(
  h: SalesDemandHarness,
  sku: Sku,
  quantity: number,
  fixtureKey: string,
) {
  await h.adjustmentIncrease.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-on-hand`,
    sku,
    quantity,
    refType: "adjustment",
    refId: `${fixtureKey}-on-hand`,
  });
}

/**
 * Commit qty while the SKU is still open (no ATP cap), sticky-lock, then seed on-hand.
 * Yields locked committed with allocated=0 so warehouse leftover and locked ATP diverge.
 */
export async function seedLockedCommittedWithoutCover(
  h: SalesDemandHarness,
  sku: Sku,
  committedQty: number,
  onHand: number,
  poId: PurchaseOrderId,
  commitRefId: string,
  fixtureKey: string,
) {
  const commit = await h.committed.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-commit`,
    sku,
    quantity: committedQty,
    refType: "sales_order",
    refId: commitRefId,
  });
  if (!commit.ok) {
    throw new Error(`seed commit failed: ${commit.reason}`);
  }

  await h.inboundFromPo.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-inbound`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });
  await h.inboundCancelled.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-cancel`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });

  await h.adjustmentIncrease.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-on-hand`,
    sku,
    quantity: onHand,
    refType: "adjustment",
    refId: `${fixtureKey}-on-hand`,
  });
}
