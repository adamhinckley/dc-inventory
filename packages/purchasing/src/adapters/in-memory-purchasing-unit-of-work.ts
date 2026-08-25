import {
  InMemoryInventoryUnitOfWork,
  RecordGoodsReceivedUseCase,
  RecordInboundCancelledUseCase,
  RecordInboundFromPoUseCase,
  type IStockLedger,
} from "@dc-inventory/inventory";
import type { IClock } from "../domain/clock.js";
import type {
  GoodsReceivedCommand,
  IInventoryCommandPort,
  InboundCancelledCommand,
  InboundFromPoCommand,
  InventoryCommandResult,
  IPurchasingUnitOfWork,
} from "../domain/ports/purchase-order-repository.js";
import { InMemoryPurchaseOrderRepository } from "./in-memory-purchase-order-repository.js";
import { InMemorySupplierRepository } from "./in-memory-supplier-repository.js";

function mapResult(
  result: { ok: true } | { ok: false; reason: string },
): InventoryCommandResult {
  if (result.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: result.reason as InventoryCommandResult extends { ok: false; reason: infer R }
      ? R
      : never,
  };
}

class InventoryCommandAdapter implements IInventoryCommandPort {
  constructor(private readonly ledger: IStockLedger) {}

  async recordInboundFromPo(command: InboundFromPoCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordInboundFromPoUseCase(this.ledger).execute({
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "purchase_order",
        refId: command.purchaseOrderId,
      }),
    );
  }

  async recordGoodsReceived(command: GoodsReceivedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordGoodsReceivedUseCase(this.ledger).execute({
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "purchase_order",
        refId: command.purchaseOrderId,
      }),
    );
  }

  async recordInboundCancelled(command: InboundCancelledCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordInboundCancelledUseCase(this.ledger).execute({
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "purchase_order",
        refId: command.purchaseOrderId,
      }),
    );
  }
}

export class InMemoryPurchasingUnitOfWork implements IPurchasingUnitOfWork {
  readonly purchaseOrders = new InMemoryPurchaseOrderRepository();
  readonly suppliers = new InMemorySupplierRepository();
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: InventoryCommandAdapter;

  constructor(clock?: IClock) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = new InventoryCommandAdapter(this.inventoryUow.ledger);
  }

  run<T>(work: (uow: IPurchasingUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => work(this));
  }

  get inventoryReadModel() {
    return this.inventoryUow.readModel;
  }
}
