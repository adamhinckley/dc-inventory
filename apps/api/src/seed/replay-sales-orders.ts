import type { IInvoiceRepository } from "@dc-inventory/accounting";
import type { ICustomerRepository } from "@dc-inventory/customers";
import {
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  ShipSalesOrderUseCase,
  type IClock,
  type ICustomerLookupPort,
  type ISalesUnitOfWork,
} from "@dc-inventory/sales";
import { CustomerId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { DemoBookPlan } from "./planner/types.js";

export class ReplaySalesOrdersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplaySalesOrdersError";
  }
}

export type PlaybackClock = IClock & {
  setInstant(instant: Date): void;
};

export type ReplaySalesOrdersPorts = {
  uow: ISalesUnitOfWork;
  clock: PlaybackClock;
  customers: Pick<ICustomerRepository, "findById">;
  invoices: Pick<IInvoiceRepository, "findByOrderId">;
};

export type ReplaySalesOrdersInput = {
  plan: DemoBookPlan;
  customerIdByKey: ReadonlyMap<string, CustomerId>;
  productNameBySku: ReadonlyMap<string, string>;
  currencyBySku: ReadonlyMap<string, string>;
  taxCategoryBySku: ReadonlyMap<string, string | undefined>;
  staffUserId: StaffUserId;
  assertWithinBudget?: () => void;
};

export type ReplaySalesOrdersResult = {
  salesOrderCount: number;
  lastSalesDocumentNumber: string;
  lastInvoiceDocumentNumber: string;
  shippedCount: number;
  leftoverConfirmedCount: number;
  leftoverDraftCount: number;
};

export function productNameBySkuFromPlan(plan: DemoBookPlan): Map<string, string> {
  return new Map(plan.master.products.map((row) => [row.sku, row.name]));
}

export function currencyBySkuFromPlan(plan: DemoBookPlan): Map<string, string> {
  return new Map(plan.master.products.map((row) => [row.sku, row.currency]));
}

export function taxCategoryBySkuFromPlan(plan: DemoBookPlan): Map<string, string | undefined> {
  return new Map(plan.master.products.map((row) => [row.sku, row.taxCategoryCode]));
}

export async function customerIdByKeyFromPlan(
  plan: DemoBookPlan,
  customers: Pick<ICustomerRepository, "findByName">,
): Promise<Map<string, CustomerId>> {
  const map = new Map<string, CustomerId>();
  for (const planned of plan.master.customers) {
    const customer = await customers.findByName(OrganizationId.DEFAULT, planned.name);
    if (customer === null) {
      throw new ReplaySalesOrdersError(`missing customer ${planned.name}`);
    }
    map.set(planned.key, customer.id);
  }
  return map;
}

function demoCustomerLookup(
  customers: Pick<ICustomerRepository, "findById">,
): ICustomerLookupPort {
  return {
    findById: async (id) => {
      const customer = await customers.findById(OrganizationId.DEFAULT, id);
      return customer === null ? null : { id: customer.id };
    },
  };
}

export async function runReplaySalesOrders(
  ports: ReplaySalesOrdersPorts,
  input: ReplaySalesOrdersInput,
): Promise<ReplaySalesOrdersResult> {
  const create = new CreateSalesOrderUseCase(
    ports.uow.salesOrders,
    demoCustomerLookup(ports.customers),
    ports.clock,
  );
  const confirm = new ConfirmSalesOrderUseCase(ports.uow);
  const ship = new ShipSalesOrderUseCase(ports.uow);
  const shipInstantBySalesOrderKey = new Map(
    input.plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );

  let shippedCount = 0;
  let leftoverConfirmedCount = 0;
  let leftoverDraftCount = 0;
  let lastSalesDocumentNumber = "";
  let lastInvoiceDocumentNumber = "";

  for (const planned of input.plan.salesOrders) {
    input.assertWithinBudget?.();
    ports.clock.setInstant(planned.plannedInstant);

    const customerId = input.customerIdByKey.get(planned.customerKey);
    if (customerId === undefined) {
      throw new ReplaySalesOrdersError(`missing customer key ${planned.customerKey}`);
    }

    const lines = planned.lines.map((line) => {
      const name = input.productNameBySku.get(line.sku);
      const currency = input.currencyBySku.get(line.sku);
      if (name === undefined || currency === undefined) {
        throw new ReplaySalesOrdersError(`missing product metadata for sku ${line.sku}`);
      }
      return {
        sku: line.sku,
        name,
        qty: line.qty,
        unitPriceCents: line.unitPriceCents,
        currency,
        taxCategoryCode: input.taxCategoryBySku.get(line.sku),
      };
    });

    const created = await create.execute({
      staffUserId: input.staffUserId,
      customerId,
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

    lastSalesDocumentNumber = created.salesOrder.documentNumber;

    if (planned.status === "leftoverDraft") {
      leftoverDraftCount += 1;
      continue;
    }

    const shipInstant = shipInstantBySalesOrderKey.get(planned.key) ?? planned.plannedInstant;
    const confirmInstant = new Date(
      Math.min(planned.plannedInstant.getTime(), shipInstant.getTime()),
    );
    ports.clock.setInstant(confirmInstant);

    const confirmed = await confirm.execute({
      staffUserId: input.staffUserId,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: `demo:${planned.key}:confirm`,
    });
    if (!confirmed.ok) {
      throw new ReplaySalesOrdersError(`confirm ${planned.key} failed: ${confirmed.reason}`);
    }

    lastSalesDocumentNumber = confirmed.salesOrder.documentNumber;

    if (planned.status === "leftoverConfirmed") {
      leftoverConfirmedCount += 1;
      continue;
    }

    ports.clock.setInstant(shipInstant);

    const shipped = await ship.execute({
      staffUserId: input.staffUserId,
      salesOrderId: confirmed.salesOrder.id,
      idempotencyKey: `demo:${planned.key}:ship`,
    });
    if (!shipped.ok) {
      throw new ReplaySalesOrdersError(`ship ${planned.key} failed: ${shipped.reason}`);
    }

    shippedCount += 1;
    lastSalesDocumentNumber = shipped.salesOrder.documentNumber;

    const invoice = await ports.invoices.findByOrderId(shipped.salesOrder.id);
    if (invoice === null) {
      throw new ReplaySalesOrdersError(`ship ${planned.key} did not create an invoice`);
    }
    lastInvoiceDocumentNumber = invoice.documentNumber;
  }

  return {
    salesOrderCount: input.plan.salesOrders.length,
    lastSalesDocumentNumber,
    lastInvoiceDocumentNumber,
    shippedCount,
    leftoverConfirmedCount,
    leftoverDraftCount,
  };
}
