import {
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
  type IClock,
  type ISupplierRepository,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
import { SupplierId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { DemoBookPlan } from "./planner/types.js";

export class ReplayPurchaseOrdersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayPurchaseOrdersError";
  }
}

export type PlaybackClock = IClock & {
  setInstant(instant: Date): void;
};

export type ReplayPurchaseOrdersPorts = {
  uow: IPurchasingUnitOfWork;
  clock: PlaybackClock;
};

export type ReplayPurchaseOrdersInput = {
  plan: DemoBookPlan;
  supplierIdByKey: ReadonlyMap<string, SupplierId>;
  productNameBySku: ReadonlyMap<string, string>;
  staffUserId: StaffUserId;
};

export type ReplayPurchaseOrdersResult = {
  purchaseOrderCount: number;
  lastDocumentNumber: string;
  leftoverConfirmedCount: number;
  receivedCount: number;
};

export function productNameBySkuFromPlan(plan: DemoBookPlan): Map<string, string> {
  return new Map(plan.master.products.map((row) => [row.sku, row.name]));
}

export async function supplierIdByKeyFromPlan(
  plan: DemoBookPlan,
  suppliers: ISupplierRepository,
): Promise<Map<string, SupplierId>> {
  const map = new Map<string, SupplierId>();
  for (const planned of plan.master.suppliers) {
    const supplier = await suppliers.findByVendorNumber(planned.vendorNumber);
    if (supplier === null) {
      throw new ReplayPurchaseOrdersError(`missing supplier ${planned.vendorNumber}`);
    }
    map.set(planned.key, supplier.id);
  }
  return map;
}

export async function runReplayPurchaseOrders(
  ports: ReplayPurchaseOrdersPorts,
  input: ReplayPurchaseOrdersInput,
): Promise<ReplayPurchaseOrdersResult> {
  const create = new CreatePurchaseOrderUseCase(
    ports.uow.purchaseOrders,
    ports.uow.suppliers,
    ports.clock,
  );
  const confirm = new ConfirmPurchaseOrderUseCase(ports.uow);
  const receive = new ReceivePurchaseOrderUseCase(ports.uow);

  let leftoverConfirmedCount = 0;
  let receivedCount = 0;
  let lastDocumentNumber = "";

  for (const planned of input.plan.purchaseOrders) {
    ports.clock.setInstant(planned.plannedInstant);

    const supplierId = input.supplierIdByKey.get(planned.supplierKey);
    if (supplierId === undefined) {
      throw new ReplayPurchaseOrdersError(`missing supplier key ${planned.supplierKey}`);
    }

    const lines = planned.lines.map((line) => {
      const name = input.productNameBySku.get(line.sku);
      if (name === undefined) {
        throw new ReplayPurchaseOrdersError(`missing product name for sku ${line.sku}`);
      }
      return { sku: line.sku, name, qty: line.qty };
    });

    const created = await create.execute({
      staffUserId: input.staffUserId,
      supplierId,
      lines,
    });
    if (!created.ok) {
      throw new ReplayPurchaseOrdersError(`create ${planned.key} failed: ${created.reason}`);
    }

    const confirmed = await confirm.execute({
      staffUserId: input.staffUserId,
      purchaseOrderId: created.purchaseOrder.id,
      idempotencyKey: `demo:${planned.key}:confirm`,
    });
    if (!confirmed.ok) {
      throw new ReplayPurchaseOrdersError(`confirm ${planned.key} failed: ${confirmed.reason}`);
    }

    lastDocumentNumber = confirmed.purchaseOrder.documentNumber;

    if (planned.status === "leftoverConfirmed") {
      leftoverConfirmedCount += 1;
      continue;
    }

    const receiveLines = confirmed.purchaseOrder.lines.map((line) => ({
      lineId: line.id,
      quantity: line.qty - line.receivedQty,
    }));

    const received = await receive.execute({
      staffUserId: input.staffUserId,
      purchaseOrderId: confirmed.purchaseOrder.id,
      idempotencyKey: `demo:${planned.key}:receive`,
      lines: receiveLines,
    });
    if (!received.ok) {
      throw new ReplayPurchaseOrdersError(`receive ${planned.key} failed: ${received.reason}`);
    }

    receivedCount += 1;
    lastDocumentNumber = received.purchaseOrder.documentNumber;
  }

  return {
    purchaseOrderCount: input.plan.purchaseOrders.length,
    lastDocumentNumber,
    leftoverConfirmedCount,
    receivedCount,
  };
}
