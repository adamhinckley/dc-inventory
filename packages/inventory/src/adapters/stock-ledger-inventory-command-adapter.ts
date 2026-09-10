import { LocationId } from "@dc-inventory/shared-kernel";
import { RecordAllocatedUseCase } from "../application/record-allocated.js";
import { RecordCommittedUseCase } from "../application/record-committed.js";
import { RecordDeallocatedUseCase } from "../application/record-deallocated.js";
import { RecordDecommittedUseCase } from "../application/record-decommitted.js";
import { RecordGoodsReceivedUseCase } from "../application/record-goods-received.js";
import { RecordInboundCancelledUseCase } from "../application/record-inbound-cancelled.js";
import { RecordInboundFromPoUseCase } from "../application/record-inbound-from-po.js";
import { RecordShippedUseCase } from "../application/record-shipped.js";
import { netOrderCoverQuantity } from "../domain/order-cover.js";
import type {
  AllocatedCommand,
  CommittedCommand,
  DeallocatedCommand,
  DecommittedCommand,
  GoodsReceivedCommand,
  IInventoryCommandPort,
  InboundCancelledCommand,
  InboundFromPoCommand,
  InventoryCommandResult,
  InventorySnapshotLock,
  OrderCoverQuery,
  ShippedCommand,
} from "../domain/ports/inventory-command-port.js";
import type { IInventoryReadModel, IStockLedger } from "../domain/ports/stock-ledger.js";

function mapResult(
  result:
    | { ok: true }
    | { ok: false; reason: string; availableToSell?: number; failedIdempotencyKey?: string },
): InventoryCommandResult {
  if (result.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: result.reason as InventoryCommandResult extends { ok: false; reason: infer R }
      ? R
      : never,
    ...(result.availableToSell !== undefined
      ? { availableToSell: result.availableToSell }
      : {}),
    ...(result.failedIdempotencyKey !== undefined
      ? { failedIdempotencyKey: result.failedIdempotencyKey }
      : {}),
  };
}

export class StockLedgerInventoryCommandAdapter implements IInventoryCommandPort {
  private readonly inboundFromPo: RecordInboundFromPoUseCase;
  private readonly goodsReceived: RecordGoodsReceivedUseCase;
  private readonly inboundCancelled: RecordInboundCancelledUseCase;
  private readonly committed: RecordCommittedUseCase;
  private readonly decommitted: RecordDecommittedUseCase;
  private readonly allocated: RecordAllocatedUseCase;
  private readonly deallocated: RecordDeallocatedUseCase;
  private readonly shipped: RecordShippedUseCase;

  constructor(
    private readonly ledger: IStockLedger,
    private readonly readModel: IInventoryReadModel,
  ) {
    this.inboundFromPo = new RecordInboundFromPoUseCase(ledger);
    this.goodsReceived = new RecordGoodsReceivedUseCase(ledger);
    this.inboundCancelled = new RecordInboundCancelledUseCase(ledger);
    this.committed = new RecordCommittedUseCase(ledger);
    this.decommitted = new RecordDecommittedUseCase(ledger);
    this.allocated = new RecordAllocatedUseCase(ledger);
    this.deallocated = new RecordDeallocatedUseCase(ledger);
    this.shipped = new RecordShippedUseCase(ledger);
  }

  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void> {
    return this.ledger.lockSnapshots(snapshots);
  }

  async recordInboundFromPo(command: InboundFromPoCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await this.inboundFromPo.execute({
        organizationId: command.organizationId,
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
      await this.goodsReceived.execute({
        organizationId: command.organizationId,
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
      await this.inboundCancelled.execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "purchase_order",
        refId: command.purchaseOrderId,
      }),
    );
  }

  async recordCommitted(command: CommittedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await this.committed.execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
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

  async recordDecommitted(command: DecommittedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await this.decommitted.execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async matchesDecommittedIdempotency(command: DecommittedCommand): Promise<boolean> {
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
      existing.movementType === "Decommitted" &&
      existing.quantity === command.quantity &&
      existing.refType === "sales_order" &&
      existing.refId === command.orderId
    );
  }

  async recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await this.allocated.execute({
        organizationId: command.organizationId,
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
      await this.deallocated.execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async recordShipped(command: ShippedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await this.shipped.execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async recordInboundFromPoBulk(
    commands: readonly InboundFromPoCommand[],
  ): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordInboundFromPoBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "purchase_order",
          refId: command.purchaseOrderId,
        })),
      ),
    );
  }

  async recordGoodsReceivedBulk(
    commands: readonly GoodsReceivedCommand[],
  ): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordGoodsReceivedBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "purchase_order",
          refId: command.purchaseOrderId,
        })),
      ),
    );
  }

  async recordInboundCancelledBulk(
    commands: readonly InboundCancelledCommand[],
  ): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordInboundCancelledBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "purchase_order",
          refId: command.purchaseOrderId,
        })),
      ),
    );
  }

  async recordCommittedBulk(commands: readonly CommittedCommand[]): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordCommittedBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "sales_order",
          refId: command.orderId,
        })),
      ),
    );
  }

  async recordDecommittedBulk(
    commands: readonly DecommittedCommand[],
  ): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordDecommittedBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "sales_order",
          refId: command.orderId,
        })),
      ),
    );
  }

  async recordDeallocatedBulk(
    commands: readonly DeallocatedCommand[],
  ): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordDeallocatedBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "sales_order",
          refId: command.orderId,
        })),
      ),
    );
  }

  async recordShippedBulk(commands: readonly ShippedCommand[]): Promise<InventoryCommandResult> {
    return mapResult(
      await this.ledger.recordShippedBulk(
        commands.map((command) => ({
          organizationId: command.organizationId,
          idempotencyKey: command.idempotencyKey,
          sku: command.sku,
          quantity: command.quantity,
          refType: "sales_order",
          refId: command.orderId,
        })),
      ),
    );
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
