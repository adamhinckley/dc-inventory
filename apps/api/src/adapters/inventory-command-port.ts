import {
  RecordGoodsReceivedUseCase,
  RecordInboundCancelledUseCase,
  RecordInboundFromPoUseCase,
  type IStockLedger,
} from "@dc-inventory/inventory";
import type {
  GoodsReceivedCommand,
  IInventoryCommandPort,
  InventorySnapshotLock,
  InboundCancelledCommand,
  InboundFromPoCommand,
  InventoryCommandResult,
} from "@dc-inventory/purchasing";

function mapResult(result: { ok: true } | { ok: false; reason: string }): InventoryCommandResult {
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

export class StockLedgerInventoryCommandAdapter implements IInventoryCommandPort {
  private readonly inboundFromPo: RecordInboundFromPoUseCase;
  private readonly goodsReceived: RecordGoodsReceivedUseCase;
  private readonly inboundCancelled: RecordInboundCancelledUseCase;

  constructor(ledger: IStockLedger) {
    this.inboundFromPo = new RecordInboundFromPoUseCase(ledger);
    this.goodsReceived = new RecordGoodsReceivedUseCase(ledger);
    this.inboundCancelled = new RecordInboundCancelledUseCase(ledger);
    this.ledger = ledger;
  }

  private readonly ledger: IStockLedger;

  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void> {
    return this.ledger.lockSnapshots(snapshots);
  }

  async recordInboundFromPo(command: InboundFromPoCommand): Promise<InventoryCommandResult> {
    const result = await this.inboundFromPo.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "purchase_order",
      refId: command.purchaseOrderId,
    });
    return mapResult(result);
  }

  async recordGoodsReceived(command: GoodsReceivedCommand): Promise<InventoryCommandResult> {
    const result = await this.goodsReceived.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "purchase_order",
      refId: command.purchaseOrderId,
    });
    return mapResult(result);
  }

  async recordInboundCancelled(command: InboundCancelledCommand): Promise<InventoryCommandResult> {
    const result = await this.inboundCancelled.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "purchase_order",
      refId: command.purchaseOrderId,
    });
    return mapResult(result);
  }
}
