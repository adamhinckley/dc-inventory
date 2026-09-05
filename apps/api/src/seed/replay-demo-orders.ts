import type { IInvoiceRepository } from "@dc-inventory/accounting";
import type { IProductRepository } from "@dc-inventory/catalog";
import type { ICustomerRepository, IShipToRepository } from "@dc-inventory/customers";
import { CustomerShipToSnapshotReadAdapter } from "@dc-inventory/customers";
import {
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  InMemoryCatalogSkuLookupPort,
  ReceivePurchaseOrderUseCase,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
import type { PurchaseOrder } from "@dc-inventory/purchasing";
import {
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  ShipSalesOrderUseCase,
  type ICustomerBillToSnapshotReadPort,
  type ISalesUnitOfWork,
} from "@dc-inventory/sales";
import type { SalesOrder } from "@dc-inventory/sales";
import {
  OrganizationId,
  Sku,
  SupplierId,
  type CustomerId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { catalogProductPort } from "../adapters/catalog-product-port.js";
import { allocateInstant } from "./planner/allocate-instant.js";
import type { DemoBookPlan, PlannedPurchaseOrder, PlannedSalesOrder } from "./planner/types.js";
import {
  ReplayPurchaseOrdersError,
  type PlaybackClock as PurchasePlaybackClock,
} from "./replay-purchase-orders.js";
import {
  demoCustomerLookup,
  defaultShipToIdForCustomer,
  ReplaySalesOrdersError,
  type PlaybackClock as SalesPlaybackClock,
} from "./replay-sales-orders.js";

export class ReplayDemoOrdersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayDemoOrdersError";
  }
}

type DemoReplayEvent =
  | { kind: "po_open"; at: Date; planned: PlannedPurchaseOrder }
  | { kind: "po_receive"; at: Date; planned: PlannedPurchaseOrder }
  | { kind: "so_create"; at: Date; planned: PlannedSalesOrder }
  | { kind: "so_confirm"; at: Date; planned: PlannedSalesOrder }
  | { kind: "so_ship"; at: Date; planned: PlannedSalesOrder };

const EVENT_ORDER: Record<DemoReplayEvent["kind"], number> = {
  po_open: 0,
  po_receive: 1,
  so_create: 2,
  so_confirm: 3,
  so_ship: 4,
};

export type ReplayDemoOrdersPorts = {
  purchasing: IPurchasingUnitOfWork;
  sales: ISalesUnitOfWork;
  clock: PurchasePlaybackClock & SalesPlaybackClock;
  customers: Pick<ICustomerRepository, "findById">;
  shipTos: Pick<IShipToRepository, "listByCustomer" | "findById">;
  products: Pick<IProductRepository, "findBySku" | "findById">;
  invoices: Pick<IInvoiceRepository, "findByOrderId">;
  billToSnapshot: ICustomerBillToSnapshotReadPort;
};

export type ReplayDemoOrdersInput = {
  plan: DemoBookPlan;
  supplierIdByKey: ReadonlyMap<string, SupplierId>;
  customerIdByKey: ReadonlyMap<string, CustomerId>;
  productNameBySku: ReadonlyMap<string, string>;
  currencyBySku: ReadonlyMap<string, string>;
  taxCategoryBySku: ReadonlyMap<string, string | undefined>;
  staffUserId: StaffUserId;
  assertWithinBudget?: () => void;
};

export type ReplayDemoOrdersResult = {
  purchaseOrderCount: number;
  lastPurchaseDocumentNumber: string;
  leftoverConfirmedPurchaseOrderCount: number;
  receivedCount: number;
  salesOrderCount: number;
  lastSalesDocumentNumber: string;
  lastInvoiceDocumentNumber: string;
  shippedCount: number;
  leftoverConfirmedSalesOrderCount: number;
  leftoverConfirmedCount: number;
  leftoverDraftCount: number;
};

function collectDemoStockReplayEvents(plan: DemoBookPlan): DemoReplayEvent[] {
  const events: DemoReplayEvent[] = [];
  const shipInstantByKey = new Map(
    plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );

  for (const planned of plan.purchaseOrders) {
    if (planned.status === "received") {
      events.push({ kind: "po_receive", at: planned.plannedInstant, planned });
    }
  }

  for (const planned of plan.salesOrders) {
    if (planned.status === "leftoverDraft") {
      continue;
    }
    const shipAt = shipInstantByKey.get(planned.key) ?? planned.plannedInstant;
    const confirmAt = allocateInstant(
      planned.plannedInstant,
      shipAt,
      planned.status === "shipped",
    );
    events.push({ kind: "so_confirm", at: confirmAt, planned });
    if (planned.status === "shipped") {
      events.push({ kind: "so_ship", at: shipAt, planned });
    }
  }

  return events;
}

function compareDemoReplayEvents(left: DemoReplayEvent, right: DemoReplayEvent): number {
  const byTime = left.at.getTime() - right.at.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return EVENT_ORDER[left.kind] - EVENT_ORDER[right.kind];
}

type ReplayScheduleState = {
  openedPurchaseOrders: Set<string>;
  createdSalesOrders: Set<string>;
  confirmedSalesOrders: Set<string>;
};

function canScheduleStockEvent(event: DemoReplayEvent, state: ReplayScheduleState): boolean {
  switch (event.kind) {
    case "po_receive":
      return true;
    case "so_confirm":
      return true;
    case "so_ship":
      return state.confirmedSalesOrders.has(event.planned.key);
    default:
      return false;
  }
}

function markScheduledStockEvent(event: DemoReplayEvent, state: ReplayScheduleState): void {
  switch (event.kind) {
    case "so_confirm":
      state.confirmedSalesOrders.add(event.planned.key);
      break;
    case "po_receive":
    case "so_ship":
      break;
    default:
      break;
  }
}

function scheduleDemoStockReplayEvents(events: DemoReplayEvent[]): DemoReplayEvent[] {
  const pending = [...events].sort(compareDemoReplayEvents);
  const scheduled: DemoReplayEvent[] = [];
  const state: ReplayScheduleState = {
    openedPurchaseOrders: new Set(),
    createdSalesOrders: new Set(),
    confirmedSalesOrders: new Set(),
  };

  while (pending.length > 0) {
    let nextIndex = -1;
    for (let index = 0; index < pending.length; index += 1) {
      const candidate = pending[index];
      if (candidate !== undefined && canScheduleStockEvent(candidate, state)) {
        if (nextIndex === -1) {
          nextIndex = index;
          continue;
        }
        const incumbent = pending[nextIndex]!;
        if (compareDemoReplayEvents(candidate, incumbent) < 0) {
          nextIndex = index;
        }
      }
    }
    if (nextIndex === -1) {
      const blocked = pending[0];
      throw new Error(
        blocked === undefined
          ? "demo stock replay schedule stalled with no pending events"
          : `demo stock replay schedule stalled before ${blocked.kind} ${blocked.planned.key}`,
      );
    }
    const [next] = pending.splice(nextIndex, 1);
    if (next === undefined) {
      throw new Error("demo stock replay schedule lost a pending event");
    }
    scheduled.push(next);
    markScheduledStockEvent(next, state);
  }

  return scheduled;
}

export async function runReplayDemoOrders(
  ports: ReplayDemoOrdersPorts,
  input: ReplayDemoOrdersInput,
): Promise<ReplayDemoOrdersResult> {
  const catalog = new InMemoryCatalogSkuLookupPort();
  for (const [sku, name] of input.productNameBySku) {
    catalog.set(OrganizationId.DEFAULT, sku, name);
  }

  const createPo = new CreatePurchaseOrderUseCase(
    ports.purchasing.purchaseOrders,
    ports.purchasing.suppliers,
    catalog,
    ports.clock,
  );
  const confirmPo = new ConfirmPurchaseOrderUseCase(ports.purchasing, catalog);
  const receivePo = new ReceivePurchaseOrderUseCase(ports.purchasing);

  const createSo = new CreateSalesOrderUseCase(
    ports.sales.salesOrders,
    demoCustomerLookup(ports.customers),
    catalogProductPort(ports.products),
    ports.clock,
  );
  const shipToSnapshot = new CustomerShipToSnapshotReadAdapter(
    ports.customers as ICustomerRepository,
    ports.shipTos as IShipToRepository,
  );
  const confirmSo = new ConfirmSalesOrderUseCase(
    ports.sales,
    demoCustomerLookup(ports.customers),
    shipToSnapshot,
  );
  const shipSo = new ShipSalesOrderUseCase(ports.sales, ports.billToSnapshot);

  const purchaseOrdersByKey = new Map<string, PurchaseOrder>();
  const salesOrdersByKey = new Map<string, SalesOrder>();

  let leftoverConfirmedPurchaseOrderCount = 0;
  let receivedCount = 0;
  let lastPurchaseDocumentNumber = "";
  let leftoverConfirmedSalesOrderCount = 0;
  let leftoverDraftCount = 0;
  let shippedCount = 0;
  let lastSalesDocumentNumber = "";
  let lastInvoiceDocumentNumber = "";

  for (const planned of input.plan.purchaseOrders) {
    input.assertWithinBudget?.();
    ports.clock.setInstant(planned.plannedInstant);
    const supplierId = input.supplierIdByKey.get(planned.supplierKey);
    if (supplierId === undefined) {
      throw new ReplayDemoOrdersError(`missing supplier key ${planned.supplierKey}`);
    }
    const lines = planned.lines.map((line) => {
      const name = input.productNameBySku.get(line.sku);
      if (name === undefined) {
        throw new ReplayDemoOrdersError(`missing product name for sku ${line.sku}`);
      }
      return { sku: line.sku, name, qty: line.qty };
    });
    const created = await createPo.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: input.staffUserId,
      supplierId,
      lines,
    });
    if (!created.ok) {
      throw new ReplayPurchaseOrdersError(`create ${planned.key} failed: ${created.reason}`);
    }
    const confirmed = await confirmPo.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: input.staffUserId,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: `demo:${planned.key}:confirm`,
    });
    if (!confirmed.ok) {
      throw new ReplayPurchaseOrdersError(`confirm ${planned.key} failed: ${confirmed.reason}`);
    }
    purchaseOrdersByKey.set(planned.key, confirmed.purchaseOrder);
    lastPurchaseDocumentNumber = confirmed.purchaseOrder.documentNumber;
    if (planned.status === "leftoverConfirmed") {
      leftoverConfirmedPurchaseOrderCount += 1;
    }
  }

  for (const planned of input.plan.salesOrders) {
    input.assertWithinBudget?.();
    ports.clock.setInstant(planned.plannedInstant);
    const customerId = input.customerIdByKey.get(planned.customerKey);
    if (customerId === undefined) {
      throw new ReplayDemoOrdersError(`missing customer key ${planned.customerKey}`);
    }
    const lines = await Promise.all(
      planned.lines.map(async (line) => {
        const product = await ports.products.findBySku(
          OrganizationId.DEFAULT,
          Sku.parse(line.sku),
        );
        if (product === null) {
          throw new ReplayDemoOrdersError(`missing Catalog product for sku ${line.sku}`);
        }
        return { productId: product.id, qty: line.qty };
      }),
    );
    const created = await createSo.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: input.staffUserId,
      customerId,
      mode: "always_new",
      lines,
      shipLine1: planned.shipTo.line1,
      shipLine2: planned.shipTo.line2 ?? undefined,
      shipCity: planned.shipTo.city,
      shipRegion: planned.shipTo.region,
      shipPostal: planned.shipTo.postal,
      shipCountry: planned.shipTo.country,
    });
    if (!created.ok) {
      throw new ReplaySalesOrdersError(`create ${planned.key} failed: ${created.reason}`);
    }
    salesOrdersByKey.set(planned.key, created.salesOrder);
    lastSalesDocumentNumber = created.salesOrder.documentNumber;
    if (planned.status === "leftoverDraft") {
      leftoverDraftCount += 1;
    }
  }

  for (const event of scheduleDemoStockReplayEvents(collectDemoStockReplayEvents(input.plan))) {
    input.assertWithinBudget?.();
    ports.clock.setInstant(event.at);

    switch (event.kind) {
      case "po_receive": {
        const planned = event.planned;
        const confirmed = purchaseOrdersByKey.get(planned.key);
        if (confirmed === undefined) {
          throw new ReplayDemoOrdersError(`receive ${planned.key} before open`);
        }
        const receiveLines = confirmed.lines.map((line) => ({
          lineId: line.id,
          quantity: line.qty - line.receivedQty,
        }));
        const received = await receivePo.execute({
          organizationId: OrganizationId.DEFAULT,
          staffUserId: input.staffUserId,
          purchaseOrderId: confirmed.id,
          idempotencyKey: `demo:${planned.key}:receive`,
          lines: receiveLines,
        });
        if (!received.ok) {
          throw new ReplayPurchaseOrdersError(`receive ${planned.key} failed: ${received.reason}`);
        }
        purchaseOrdersByKey.set(planned.key, received.purchaseOrder);
        receivedCount += 1;
        lastPurchaseDocumentNumber = received.purchaseOrder.documentNumber;
        break;
      }
      case "so_confirm": {
        const planned = event.planned;
        const created = salesOrdersByKey.get(planned.key);
        if (created === undefined) {
          throw new ReplayDemoOrdersError(`confirm ${planned.key} before create`);
        }
        const customerId = input.customerIdByKey.get(planned.customerKey);
        if (customerId === undefined) {
          throw new ReplayDemoOrdersError(`confirm ${planned.key} before create`);
        }
        const shipToId = await defaultShipToIdForCustomer(ports.shipTos, customerId);
        const confirmed = await confirmSo.execute({
          organizationId: OrganizationId.DEFAULT,
          staffUserId: input.staffUserId,
          salesOrderId: created.id,
          idempotencyKey: `demo:${planned.key}:confirm`,
          shipToId,
        });
        if (!confirmed.ok) {
          throw new ReplaySalesOrdersError(`confirm ${planned.key} failed: ${confirmed.reason}`);
        }
        salesOrdersByKey.set(planned.key, confirmed.salesOrder);
        lastSalesDocumentNumber = confirmed.salesOrder.documentNumber;
        if (planned.status === "leftoverConfirmed") {
          leftoverConfirmedSalesOrderCount += 1;
        }
        break;
      }
      case "so_ship": {
        const planned = event.planned;
        const confirmed = salesOrdersByKey.get(planned.key);
        if (confirmed === undefined) {
          throw new ReplayDemoOrdersError(`ship ${planned.key} before create`);
        }
        const shipped = await shipSo.execute({
          organizationId: OrganizationId.DEFAULT,
          staffUserId: input.staffUserId,
          salesOrderId: confirmed.id,
          idempotencyKey: `demo:${planned.key}:ship`,
        });
        if (!shipped.ok) {
          throw new ReplaySalesOrdersError(`ship ${planned.key} failed: ${shipped.reason}`);
        }
        salesOrdersByKey.set(planned.key, shipped.salesOrder);
        shippedCount += 1;
        lastSalesDocumentNumber = shipped.salesOrder.documentNumber;
        const invoice = await ports.invoices.findByOrderId(
          OrganizationId.DEFAULT,
          shipped.salesOrder.id,
        );
        if (invoice === null) {
          throw new ReplayDemoOrdersError(`ship ${planned.key} did not create an invoice`);
        }
        lastInvoiceDocumentNumber = invoice.documentNumber;
        break;
      }
    }
  }

  const lastPlannedPurchaseOrder = input.plan.purchaseOrders.at(-1);
  if (lastPlannedPurchaseOrder !== undefined) {
    const lastPurchaseOrder = purchaseOrdersByKey.get(lastPlannedPurchaseOrder.key);
    if (lastPurchaseOrder !== undefined) {
      lastPurchaseDocumentNumber = lastPurchaseOrder.documentNumber;
    }
  }

  const lastPlannedSalesOrder = input.plan.salesOrders.at(-1);
  if (lastPlannedSalesOrder !== undefined) {
    const lastSalesOrder = salesOrdersByKey.get(lastPlannedSalesOrder.key);
    if (lastSalesOrder !== undefined) {
      lastSalesDocumentNumber = lastSalesOrder.documentNumber;
    }
  }

  return {
    purchaseOrderCount: input.plan.purchaseOrders.length,
    lastPurchaseDocumentNumber,
    leftoverConfirmedPurchaseOrderCount,
    receivedCount,
    salesOrderCount: input.plan.salesOrders.length,
    lastSalesDocumentNumber,
    lastInvoiceDocumentNumber,
    shippedCount,
    leftoverConfirmedSalesOrderCount,
    leftoverConfirmedCount: leftoverConfirmedSalesOrderCount,
    leftoverDraftCount,
  };
}

export { collectDemoStockReplayEvents, scheduleDemoStockReplayEvents };
