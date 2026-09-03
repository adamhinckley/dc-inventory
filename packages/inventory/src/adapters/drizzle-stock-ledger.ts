import type { IClock } from "../domain/clock.js";
import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  allocateReceiveCover,
  recordCommittedWithCover,
} from "../domain/cover-policy.js";
import {
  applySetSellWindow,
  isSellWindowInvalid,
  observeWindowClose,
  type DemandPersistedState,
} from "../domain/demand-model.js";
import {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
  type SnapshotDelta,
} from "../domain/ledger-rules.js";
import { MovementId, newUuid } from "../domain/ids.js";
import type { Movement, MovementType } from "../domain/movement.js";
import type {
  DemandCommandResult,
  IStockLedger,
  RecordAdjustmentDecreaseCommand,
  RecordAdjustmentIncreaseCommand,
  RecordAllocatedCommand,
  RecordCommittedCommand,
  RecordDeallocatedCommand,
  RecordDecommittedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
  ReopenSkusForPresellCommand,
  SetSellWindowCommand,
  StockCommandBase,
  StockCommandResult,
  StockSnapshotLock,
} from "../domain/ports/stock-ledger.js";
import { freezeStockFigures } from "../domain/snapshot.js";
import { stockMovements, stockSnapshots } from "../persistence/schema.js";
import type { DrizzleInventoryReadModel } from "./drizzle-inventory-read-model.js";

export type InventoryDrizzle = PostgresJsDatabase<{
  stockMovements: typeof stockMovements;
  stockSnapshots: typeof stockSnapshots;
}>;

type SnapshotRow = {
  id: string;
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
};

export class DrizzleStockLedger implements IStockLedger {
  private readonly lockedSnapshotKeys = new Set<string>();

  constructor(
    private readonly db: InventoryDrizzle,
    private readonly readModel: DrizzleInventoryReadModel,
    private readonly resolveLocationUuid: (
      organizationId: OrganizationId,
      locationId: LocationId,
    ) => Promise<string>,
    private readonly clock: IClock,
  ) {}

  async lockSnapshots(snapshots: readonly StockSnapshotLock[]): Promise<void> {
    const resolved = await Promise.all(
      snapshots.map(async (snapshot) => {
        const organizationId = requireOrganizationId(snapshot.organizationId);
        const locationId = snapshot.locationId ?? LocationId.DEFAULT;
        const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
        return {
          organizationId,
          sku: snapshot.sku.value,
          locationUuid,
          key: `${organizationId}\0${snapshot.sku.value}\0${locationUuid}`,
        };
      }),
    );
    const ordered = [...new Map(resolved.map((snapshot) => [snapshot.key, snapshot])).values()]
      .filter((snapshot) => !this.lockedSnapshotKeys.has(snapshot.key))
      .sort((left, right) => left.key.localeCompare(right.key));

    for (const snapshot of ordered) {
      await this.db
        .insert(stockSnapshots)
        .values({
          organizationId: snapshot.organizationId,
          sku: snapshot.sku,
          locationId: snapshot.locationUuid,
        })
        .onConflictDoNothing({
          target: [
            stockSnapshots.organizationId,
            stockSnapshots.sku,
            stockSnapshots.locationId,
          ],
        });
    }

    for (const snapshot of ordered) {
      const rows = await this.db
        .select({ id: stockSnapshots.id })
        .from(stockSnapshots)
        .where(
          and(
            eq(stockSnapshots.organizationId, snapshot.organizationId),
            eq(stockSnapshots.sku, snapshot.sku),
            eq(stockSnapshots.locationId, snapshot.locationUuid),
          ),
        )
        .limit(1)
        .for("update");
      if (rows[0] === undefined) {
        throw new Error("Inventory snapshot disappeared before it could be locked");
      }
      this.lockedSnapshotKeys.add(snapshot.key);
    }
  }

  recordInboundFromPo(command: RecordInboundFromPoCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("InboundFromPo", command);
  }

  recordGoodsReceived(command: RecordGoodsReceivedCommand): Promise<StockCommandResult> {
    return this.runGoodsReceivedWithCover(command);
  }

  recordInboundCancelled(command: RecordInboundCancelledCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("InboundCancelled", command);
  }

  recordAllocated(command: RecordAllocatedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Allocated", command);
  }

  recordDeallocated(command: RecordDeallocatedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Deallocated", command);
  }

  recordShipped(command: RecordShippedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Shipped", command);
  }

  recordAdjustmentIncrease(
    command: RecordAdjustmentIncreaseCommand,
  ): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("AdjustmentIncrease", command);
  }

  recordAdjustmentDecrease(
    command: RecordAdjustmentDecreaseCommand,
  ): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("AdjustmentDecrease", command);
  }

  recordCommitted(command: RecordCommittedCommand): Promise<StockCommandResult> {
    return this.runCommittedWithCover(command);
  }

  recordDecommitted(command: RecordDecommittedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Decommitted", command);
  }

  async reopenSkusForPresell(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const windowOpensAt = command.windowOpensAt ?? null;
    const windowClosesAt = command.windowClosesAt ?? null;
    if (isSellWindowInvalid(windowOpensAt, windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    for (const sku of command.skus) {
      await this.lockSnapshots([{ organizationId, sku, locationId: LocationId.DEFAULT }]);
      const locationUuid = await this.resolveLocationUuid(organizationId, LocationId.DEFAULT);
      const rows = await this.loadSnapshotRow(organizationId, sku, locationUuid);
      if (rows === undefined) {
        throw new Error("Locked inventory snapshot is missing");
      }
      await this.db
        .update(stockSnapshots)
        .set({
          stickyLocked: false,
          windowOpensAt,
          windowClosesAt,
          updatedAt: new Date(),
        })
        .where(eq(stockSnapshots.id, rows.id));
    }
    return { ok: true };
  }

  async setSellWindow(command: SetSellWindowCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    if (isSellWindowInvalid(command.windowOpensAt, command.windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    const demand = await this.readModel.getDemandState(command.sku, locationId, organizationId);
    const now = this.clock.now();
    const nextDemand = applySetSellWindow(
      demand,
      command.windowOpensAt,
      command.windowClosesAt,
      now,
    );
    const rows = await this.loadSnapshotRow(organizationId, command.sku, locationUuid);
    if (rows === undefined) {
      throw new Error("Locked inventory snapshot is missing");
    }
    await this.db
      .update(stockSnapshots)
      .set({
        windowOpensAt: nextDemand.windowOpensAt,
        windowClosesAt: nextDemand.windowClosesAt,
        stickyLocked: nextDemand.stickyLocked,
        updatedAt: new Date(),
      })
      .where(eq(stockSnapshots.id, rows.id));
    return { ok: true };
  }

  private async runCommittedWithCover(
    command: RecordCommittedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    await this.observeWindowCloseOnWrite(command.sku, locationId, organizationId);

    const now = this.clock.now();
    return recordCommittedWithCover(command, {
      readState: async () => ({
        figures: await this.readModel.getSnapshot(command.sku, locationId, organizationId),
        demand: await this.readModel.getDemandState(command.sku, locationId, organizationId),
        now,
      }),
      record: (movementType, coverCommand) => this.record(movementType, coverCommand),
    });
  }

  private async runGoodsReceivedWithCover(
    command: RecordGoodsReceivedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    const now = this.clock.now();

    const receiveResult = await this.recordWithDemandObservation("GoodsReceived", command);
    if (!receiveResult.ok) {
      return receiveResult;
    }

    const coverResult = await allocateReceiveCover(command, command.quantity, {
      readState: async () => ({
        figures: await this.readModel.getSnapshot(command.sku, locationId, organizationId),
        demand: await this.readModel.getDemandState(command.sku, locationId, organizationId),
        now,
      }),
      listMovements: async () =>
        (await this.readModel.listMovements({
          organizationId,
          sku: command.sku,
          locationId,
        })).map((movement) => ({
          movementType: movement.movementType,
          quantity: movement.quantity,
          refType: movement.refType,
          refId: movement.refId,
          createdAt: movement.createdAt,
        })),
      record: (movementType, coverCommand) => this.record(movementType, coverCommand),
    });
    if (coverResult !== null && !coverResult.ok) {
      return coverResult;
    }

    return receiveResult;
  }

  private async recordWithDemandObservation(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    await this.observeWindowCloseOnWrite(command.sku, locationId, organizationId);
    return this.record(movementType, command);
  }

  private async observeWindowCloseOnWrite(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): Promise<void> {
    const demand = await this.readModel.getDemandState(sku, locationId, organizationId);
    const observed = observeWindowClose(demand, this.clock.now());
    if (observed.stickyLocked !== demand.stickyLocked) {
      const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
      const rows = await this.loadSnapshotRow(organizationId, sku, locationUuid);
      if (rows !== undefined) {
        await this.db
          .update(stockSnapshots)
          .set({ stickyLocked: true, updatedAt: new Date() })
          .where(eq(stockSnapshots.id, rows.id));
      }
    }
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

    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);

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
    const demand = await this.readModel.getDemandState(command.sku, locationId, organizationId);
    const deltaResult = computeSnapshotDelta(
      movementType,
      command.quantity,
      current,
      demand.committed,
    );
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

    await this.applySnapshotDelta(
      organizationId,
      command.sku,
      locationUuid,
      deltaResult.delta,
      current,
      demand,
    );

    return { ok: true, movement };
  }

  private async applySnapshotDelta(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
    delta: SnapshotDelta,
    current: Awaited<ReturnType<DrizzleInventoryReadModel["getSnapshot"]>>,
    demand: DemandPersistedState,
  ): Promise<void> {
    const nextFigures = freezeStockFigures(
      current.onHand + (delta.onHand ?? 0),
      current.onOrder + (delta.onOrder ?? 0),
      current.allocated + (delta.allocated ?? 0),
    );
    const nextDemand: DemandPersistedState = {
      committed: demand.committed + (delta.committed ?? 0),
      stickyLocked: delta.stickyLocked ?? demand.stickyLocked,
      windowOpensAt:
        delta.windowOpensAt !== undefined ? delta.windowOpensAt : demand.windowOpensAt,
      windowClosesAt:
        delta.windowClosesAt !== undefined ? delta.windowClosesAt : demand.windowClosesAt,
    };

    const rows = await this.loadSnapshotRow(organizationId, sku, locationUuid);
    if (rows === undefined) {
      throw new Error("Locked inventory snapshot is missing");
    }
    await this.db
      .update(stockSnapshots)
      .set({
        onHand: nextFigures.onHand,
        onOrder: nextFigures.onOrder,
        allocated: nextFigures.allocated,
        committed: nextDemand.committed,
        stickyLocked: nextDemand.stickyLocked,
        windowOpensAt: nextDemand.windowOpensAt,
        windowClosesAt: nextDemand.windowClosesAt,
        updatedAt: new Date(),
      })
      .where(eq(stockSnapshots.id, rows.id));
  }

  private async loadSnapshotRow(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
  ): Promise<SnapshotRow | undefined> {
    const rows = await this.db
      .select({
        id: stockSnapshots.id,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        allocated: stockSnapshots.allocated,
        committed: stockSnapshots.committed,
        stickyLocked: stockSnapshots.stickyLocked,
        windowOpensAt: stockSnapshots.windowOpensAt,
        windowClosesAt: stockSnapshots.windowClosesAt,
      })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.organizationId, organizationId),
          eq(stockSnapshots.sku, sku.value),
          eq(stockSnapshots.locationId, locationUuid),
        ),
      )
      .limit(1);
    return rows[0];
  }
}
