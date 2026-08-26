import {
  RecordAllocatedUseCase,
  RecordDeallocatedUseCase,
  RecordShippedUseCase,
  type IStockLedger,
} from "@dc-inventory/inventory";
import type {
  AllocatedCommand,
  DeallocatedCommand,
  IInventoryCommandPort as ISalesInventoryCommandPort,
  InventoryCommandResult as SalesInventoryCommandResult,
  ShippedCommand,
} from "@dc-inventory/sales";

function mapResult(
  result: { ok: true } | { ok: false; reason: string },
): SalesInventoryCommandResult {
  if (result.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: result.reason as SalesInventoryCommandResult extends { ok: false; reason: infer R }
      ? R
      : never,
  };
}

export class SalesStockLedgerInventoryCommandAdapter implements ISalesInventoryCommandPort {
  private readonly allocated: RecordAllocatedUseCase;
  private readonly deallocated: RecordDeallocatedUseCase;
  private readonly shipped: RecordShippedUseCase;

  constructor(ledger: IStockLedger) {
    this.allocated = new RecordAllocatedUseCase(ledger);
    this.deallocated = new RecordDeallocatedUseCase(ledger);
    this.shipped = new RecordShippedUseCase(ledger);
  }

  async recordAllocated(command: AllocatedCommand): Promise<SalesInventoryCommandResult> {
    const result = await this.allocated.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "sales_order",
      refId: command.orderId,
    });
    return mapResult(result);
  }

  async recordDeallocated(command: DeallocatedCommand): Promise<SalesInventoryCommandResult> {
    const result = await this.deallocated.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "sales_order",
      refId: command.orderId,
    });
    return mapResult(result);
  }

  async recordShipped(command: ShippedCommand): Promise<SalesInventoryCommandResult> {
    const result = await this.shipped.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "sales_order",
      refId: command.orderId,
    });
    return mapResult(result);
  }
}
