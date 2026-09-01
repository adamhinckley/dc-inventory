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
} from "@dc-inventory/shared-kernel";
import { InMemoryCatalogProductPort } from "../../src/adapters/in-memory-catalog-product-port.js";
import { InMemorySalesUnitOfWork } from "../../src/adapters/in-memory-sales-unit-of-work.js";
import type { IClock } from "../../src/domain/clock.js";
import {
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  ShipSalesOrderUseCase,
} from "../../src/index.js";

export const DEFAULT_ORG = OrganizationId.DEFAULT;
export const DEFAULT_LOCATION = LocationId.DEFAULT;
export const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
export const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

export const OPEN_SKU = Sku.parse("SALES-OPEN-1");
export const LOCK_SKU = Sku.parse("SALES-LOCK-1");
export const COVER_SKU = Sku.parse("SALES-COVER-1");

export const OPEN_PRODUCT_ID = ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
export const LOCK_PRODUCT_ID = ProductId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
export const COVER_PRODUCT_ID = ProductId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

export const PO_LOCK = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440050");
export const PO_COVER = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440051");

export type SalesDemandHarness = ReturnType<typeof salesDemandHarness>;

export function salesDemandHarness(clock?: IClock) {
  const uow = new InMemorySalesUnitOfWork(clock);
  const ledger = uow.ledger;
  const readModel = uow.inventoryReadModel;

  const customers = {
    findById: async (organizationId: OrganizationId, id: CustomerId) => {
      if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
        return { id };
      }
      return null;
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

  const create = new CreateSalesOrderUseCase(uow.salesOrders, customers, catalog);
  const confirm = new ConfirmSalesOrderUseCase(uow);
  const cancel = new CancelSalesOrderUseCase(uow);
  const ship = new ShipSalesOrderUseCase(uow);
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

  async function createDraft(
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

  return {
    uow,
    ledger,
    readModel,
    create,
    confirm,
    cancel,
    ship,
    snapshot,
    inboundFromPo,
    inboundCancelled,
    adjustmentIncrease,
    goodsReceived,
    committed,
    demandSnapshot,
    createDraft,
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
