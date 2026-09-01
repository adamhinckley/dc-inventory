import {
  RecordAllocatedUseCase,
  RecordCommittedUseCase,
  RecordDeallocatedUseCase,
  RecordDecommittedUseCase,
  RecordShippedUseCase,
  type IInventoryReadModel,
  type IStockLedger,
} from "@dc-inventory/inventory";
import { LocationId } from "@dc-inventory/shared-kernel";
import { netOrderCoverQuantity } from "@dc-inventory/sales";
import type {
  AllocatedCommand,
  CommittedCommand,
  DeallocatedCommand,
  DecommittedCommand,
  IInventoryCommandPort as ISalesInventoryCommandPort,
  InventorySnapshotLock,
  InventoryCommandResult as SalesInventoryCommandResult,
  OrderCoverQuery,
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
  private readonly ledger: IStockLedger;
  private readonly readModel: IInventoryReadModel;
  private readonly committed: RecordCommittedUseCase;
  private readonly decommitted: RecordDecommittedUseCase;
  private readonly allocated: RecordAllocatedUseCase;
  private readonly deallocated: RecordDeallocatedUseCase;
  private readonly shipped: RecordShippedUseCase;

  constructor(ledger: IStockLedger, readModel: IInventoryReadModel) {
    this.ledger = ledger;
    this.readModel = readModel;
    this.committed = new RecordCommittedUseCase(ledger);
    this.decommitted = new RecordDecommittedUseCase(ledger);
    this.allocated = new RecordAllocatedUseCase(ledger);
    this.deallocated = new RecordDeallocatedUseCase(ledger);
    this.shipped = new RecordShippedUseCase(ledger);
  }

  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void> {
    return this.ledger.lockSnapshots(snapshots);
  }

  async recordCommitted(command: CommittedCommand): Promise<SalesInventoryCommandResult> {
    const result = await this.committed.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "sales_order",
      refId: command.orderId,
    });
    return mapResult(result);
  }

  async matchesCommittedIdempotency(command: CommittedCommand): Promise<boolean> {
    const movements = await this.readModel.listMovements({
      organizationId: command.organizationId,
      sku: command.sku,
      locationId: LocationId.DEFAULT,
    });
    const existing = movements.find((movement) => movement.idempotencyKey === command.idempotencyKey);
    if (existing === undefined) {
      return false;
    }
    return (
      existing.movementType === "Committed" &&
      existing.quantity === command.quantity &&
      existing.refType === "sales_order" &&
      existing.refId === command.orderId
    );
  }

  async recordDecommitted(command: DecommittedCommand): Promise<SalesInventoryCommandResult> {
    const result = await this.decommitted.execute({
      organizationId: command.organizationId,
      idempotencyKey: command.idempotencyKey,
      sku: command.sku,
      quantity: command.quantity,
      refType: "sales_order",
      refId: command.orderId,
    });
    return mapResult(result);
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

  async getOrderCoverQuantity(query: OrderCoverQuery): Promise<number> {
    const movements = await this.readModel.listMovements({
      organizationId: query.organizationId,
      sku: query.sku,
      locationId: LocationId.DEFAULT,
    });
    return netOrderCoverQuantity(movements, query.orderId);
  }
}
