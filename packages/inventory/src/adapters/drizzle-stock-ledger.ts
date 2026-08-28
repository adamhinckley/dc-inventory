import type { IClock } from "../domain/clock.js";
import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
} from "../domain/ledger-rules.js";
import { MovementId, newUuid } from "../domain/ids.js";
import type { Movement, MovementType } from "../domain/movement.js";
import type {
  IStockLedger,
  RecordAdjustmentDecreaseCommand,
  RecordAdjustmentIncreaseCommand,
  RecordAllocatedCommand,
  RecordDeallocatedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
  StockCommandBase,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";
import { freezeStockFigures, ZERO_STOCK_FIGURES } from "../domain/snapshot.js";
import { stockMovements, stockSnapshots } from "../persistence/schema.js";
import type { DrizzleInventoryReadModel } from "./drizzle-inventory-read-model.js";

export type InventoryDrizzle = PostgresJsDatabase<{
  stockMovements: typeof stockMovements;
  stockSnapshots: typeof stockSnapshots;
}>;

export class DrizzleStockLedger implements IStockLedger {
  constructor(
    private readonly db: InventoryDrizzle,
    private readonly readModel: DrizzleInventoryReadModel,
    private readonly resolveLocationUuid: (
      organizationId: OrganizationId,
      locationId: LocationId,
    ) => Promise<string>,
    private readonly clock: IClock,
  ) {}

  recordInboundFromPo(command: RecordInboundFromPoCommand): Promise<StockCommandResult> {
    return this.record("InboundFromPo", command);
  }

  recordGoodsReceived(command: RecordGoodsReceivedCommand): Promise<StockCommandResult> {
    return this.record("GoodsReceived", command);
  }

  recordInboundCancelled(command: RecordInboundCancelledCommand): Promise<StockCommandResult> {
    return this.record("InboundCancelled", command);
  }

  recordAllocated(command: RecordAllocatedCommand): Promise<StockCommandResult> {
    return this.record("Allocated", command);
  }

  recordDeallocated(command: RecordDeallocatedCommand): Promise<StockCommandResult> {
    return this.record("Deallocated", command);
  }

  recordShipped(command: RecordShippedCommand): Promise<StockCommandResult> {
    return this.record("Shipped", command);
  }

  recordAdjustmentIncrease(
    command: RecordAdjustmentIncreaseCommand,
  ): Promise<StockCommandResult> {
    return this.record("AdjustmentIncrease", command);
  }

  recordAdjustmentDecrease(
    command: RecordAdjustmentDecreaseCommand,
  ): Promise<StockCommandResult> {
    return this.record("AdjustmentDecrease", command);
  }

  private async record(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    if (!isPositiveIntegerQuantity(command.quantity)) {
      return { ok: false, reason: "invalid_quantity" };
    }

    const existing = await this.readModel.findMovementByIdempotency(
      organizationId,
      command.idempotencyKey,
      command.sku,
    );
    if (existing) {
      if (movementMatchesCommand(existing, movementType, command, locationId, organizationId)) {
        return { ok: true, movement: existing };
      }
      return { ok: false, reason: "idempotency_conflict" };
    }

    if (
      isOnceOnlyProvenanceType(movementType) &&
      (await this.readModel.hasProvenance(
        organizationId,
        command.refType,
        command.refId,
        command.sku,
        movementType,
      ))
    ) {
      return { ok: false, reason: "provenance_conflict" };
    }

    const current = await this.readModel.getSnapshot(command.sku, locationId, organizationId);
    const deltaResult = computeSnapshotDelta(movementType, command.quantity, current);
    if (!deltaResult.ok) {
      return deltaResult;
    }

    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    const movement: Movement = Object.freeze({
      id: MovementId.parse(newUuid()),
      organizationId,
      sku: command.sku,
      locationId,
      movementType,
      quantity: command.quantity,
      refType: command.refType,
      refId: command.refId,
      idempotencyKey: command.idempotencyKey,
      createdAt: this.clock.now(),
    });

    await this.db.insert(stockMovements).values({
      id: movement.id,
      organizationId: movement.organizationId,
      sku: movement.sku.value,
      locationId: locationUuid,
      movementType: movement.movementType,
      qty: movement.quantity,
      refType: movement.refType,
      refId: movement.refId,
      idempotencyKey: movement.idempotencyKey,
      createdAt: movement.createdAt,
    });

    const next = freezeStockFigures(
      current.onHand + (deltaResult.delta.onHand ?? 0),
      current.onOrder + (deltaResult.delta.onOrder ?? 0),
      current.allocated + (deltaResult.delta.allocated ?? 0),
    );

    const existingSnapshot = await this.db
      .select({ id: stockSnapshots.id })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.organizationId, organizationId),
          eq(stockSnapshots.sku, command.sku.value),
          eq(stockSnapshots.locationId, locationUuid),
        ),
      )
      .limit(1);

    if (existingSnapshot[0] === undefined) {
      await this.db.insert(stockSnapshots).values({
        organizationId,
        sku: command.sku.value,
        locationId: locationUuid,
        onHand: next.onHand,
        onOrder: next.onOrder,
        allocated: next.allocated,
      });
    } else {
      await this.db
        .update(stockSnapshots)
        .set({
          onHand: next.onHand,
          onOrder: next.onOrder,
          allocated: next.allocated,
          updatedAt: new Date(),
        })
        .where(eq(stockSnapshots.id, existingSnapshot[0].id));
    }

    return { ok: true, movement };
  }
}
