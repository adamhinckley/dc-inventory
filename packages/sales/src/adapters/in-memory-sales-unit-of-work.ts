import {
  InMemoryInventoryUnitOfWork,
  RecordAllocatedUseCase,
  RecordDeallocatedUseCase,
  type IStockLedger,
} from "@dc-inventory/inventory";
import type {
  AllocatedCommand,
  DeallocatedCommand,
  IInventoryCommandPort,
  InventoryCommandResult,
  ISalesUnitOfWork,
} from "../domain/ports/sales-order-repository.js";
import { InMemorySalesOrderRepository } from "./in-memory-sales-order-repository.js";

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

  async recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordAllocatedUseCase(this.ledger).execute({
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async recordDeallocated(command: DeallocatedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordDeallocatedUseCase(this.ledger).execute({
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }
}

export class InMemorySalesUnitOfWork implements ISalesUnitOfWork {
  readonly salesOrders = new InMemorySalesOrderRepository();
  private readonly inventoryUow = new InMemoryInventoryUnitOfWork();
  readonly inventory = new InventoryCommandAdapter(this.inventoryUow.ledger);

  run<T>(work: (uow: ISalesUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => work(this));
  }

  get inventoryReadModel() {
    return this.inventoryUow.readModel;
  }

  get ledger() {
    return this.inventoryUow.ledger;
  }
}
