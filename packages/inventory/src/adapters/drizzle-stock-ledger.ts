import type { IClock } from "../domain/clock.js";
import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { allocateReceiveCover, recordCommittedWithCover } from "../domain/cover-policy.js";
import {
  applySetSellWindow,
  isSellWindowInvalid,
  observeWindowClose,
  projectDemandFigures,
  type DemandPersistedState,
  type DemandStockFigures,
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
  CloseSkusForPresellCommand,
  CloseSkusForPresellResult,
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

const snapshotRowColumns = {
  id: stockSnapshots.id,
  onHand: stockSnapshots.onHand,
  onOrder: stockSnapshots.onOrder,
  allocated: stockSnapshots.allocated,
  committed: stockSnapshots.committed,
  stickyLocked: stockSnapshots.stickyLocked,
  windowOpensAt: stockSnapshots.windowOpensAt,
  windowClosesAt: stockSnapshots.windowClosesAt,
};

function snapshotKey(organizationId: string, sku: string, locationUuid: string): string {
  return `${organizationId}\0${sku}\0${locationUuid}`;
}

function demandOf(row: SnapshotRow): DemandPersistedState {
  return Object.freeze({
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  });
}

/**
 * Postgres stock ledger. One instance lives for one transaction.
 *
 * `lockSnapshots` takes `SELECT … FOR UPDATE` on the snapshot rows and keeps
 * them in memory; later reads in a command use that copy and every write
 * refreshes it. Nothing else can change a locked row until commit, so the copy
 * is exact and a command costs three round trips (conflict check, movement
 * insert, snapshot update) instead of eight.
 */
export class DrizzleStockLedger implements IStockLedger {
  private readonly lockedRows = new Map<string, SnapshotRow>();

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
          key: snapshotKey(organizationId, snapshot.sku.value, locationUuid),
        };
      }),
    );
    const ordered = [...new Map(resolved.map((snapshot) => [snapshot.key, snapshot])).values()]
      .filter((snapshot) => !this.lockedRows.has(snapshot.key))
      .sort((left, right) => left.key.localeCompare(right.key));
    if (ordered.length === 0) {
      return;
    }

    const groups = new Map<string, typeof ordered>();
    for (const snapshot of ordered) {
      const groupKey = `${snapshot.organizationId}\0${snapshot.locationUuid}`;
      const group = groups.get(groupKey) ?? [];
      group.push(snapshot);
      groups.set(groupKey, group);
    }

    for (const group of groups.values()) {
      const first = group[0];
      if (first === undefined) {
        continue;
      }
      await this.db
        .insert(stockSnapshots)
        .values(
          group.map((snapshot) => ({
            organizationId: snapshot.organizationId,
            sku: snapshot.sku,
            locationId: snapshot.locationUuid,
          })),
        )
        .onConflictDoNothing({
          target: [
            stockSnapshots.organizationId,
            stockSnapshots.sku,
            stockSnapshots.locationId,
          ],
        });
      const rows = await this.db
        .select({ ...snapshotRowColumns, sku: stockSnapshots.sku })
        .from(stockSnapshots)
        .where(
          and(
            eq(stockSnapshots.organizationId, first.organizationId),
            eq(stockSnapshots.locationId, first.locationUuid),
            inArray(
              stockSnapshots.sku,
              group.map((snapshot) => snapshot.sku),
            ),
          ),
        )
        .for("update");
      if (rows.length !== group.length) {
        throw new Error("Inventory snapshot disappeared before it could be locked");
      }
      for (const { sku, ...row } of rows) {
        this.lockedRows.set(snapshotKey(first.organizationId, sku, first.locationUuid), row);
      }
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

    const uniqueSkus = [...new Map(command.skus.map((sku) => [sku.value, sku])).values()];
    if (uniqueSkus.length === 0) {
      return { ok: true };
    }

    await this.lockSnapshots(
      uniqueSkus.map((sku) => ({
        organizationId,
        sku,
        locationId: LocationId.DEFAULT,
      })),
    );
    const locationUuid = await this.resolveLocationUuid(organizationId, LocationId.DEFAULT);
    await this.db
      .update(stockSnapshots)
      .set({
        stickyLocked: false,
        windowOpensAt,
        windowClosesAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stockSnapshots.organizationId, organizationId),
          eq(stockSnapshots.locationId, locationUuid),
          inArray(
            stockSnapshots.sku,
            uniqueSkus.map((sku) => sku.value),
          ),
        ),
      );
    for (const sku of uniqueSkus) {
      const row = this.lockedSnapshot(organizationId, sku, locationUuid);
      this.rememberRow(organizationId, sku, locationUuid, {
        ...row,
        stickyLocked: false,
        windowOpensAt,
        windowClosesAt,
      });
    }
    return { ok: true };
  }

  async closeSkusForPresell(command: CloseSkusForPresellCommand): Promise<CloseSkusForPresellResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const now = this.clock.now();
    let closedCount = 0;

    for (const sku of command.skus) {
      await this.lockSnapshots([{ organizationId, sku, locationId: LocationId.DEFAULT }]);
      const locationUuid = await this.resolveLocationUuid(organizationId, LocationId.DEFAULT);
      const row = this.lockedSnapshot(organizationId, sku, locationUuid);
      const demand = demandOf(row);
      if (demand.stickyLocked) {
        continue;
      }
      const nextDemand = applySetSellWindow(demand, demand.windowOpensAt, now, now);
      if (!nextDemand.stickyLocked) {
        continue;
      }
      await this.writeDemand(organizationId, sku, locationUuid, row, nextDemand);
      closedCount++;
    }
    return { ok: true, closedCount };
  }

  async setSellWindow(command: SetSellWindowCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    if (isSellWindowInvalid(command.windowOpensAt, command.windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    const row = this.lockedSnapshot(organizationId, command.sku, locationUuid);
    const nextDemand = applySetSellWindow(
      demandOf(row),
      command.windowOpensAt,
      command.windowClosesAt,
      this.clock.now(),
    );
    await this.writeDemand(organizationId, command.sku, locationUuid, row, nextDemand);
    return { ok: true };
  }

  private async runCommittedWithCover(
    command: RecordCommittedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    await this.observeWindowCloseOnWrite(command.sku, organizationId, locationUuid);

    const now = this.clock.now();
    return recordCommittedWithCover(command, {
      readState: () => this.coverReadState(organizationId, command.sku, locationUuid, now),
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

    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    const coverResult = await allocateReceiveCover(command, command.quantity, {
      readState: () => this.coverReadState(organizationId, command.sku, locationUuid, now),
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

  private coverReadState(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
    now: Date,
  ): { figures: DemandStockFigures; demand: DemandPersistedState; now: Date } {
    const row = this.lockedSnapshot(organizationId, sku, locationUuid);
    return { figures: this.figuresOf(row, now), demand: demandOf(row), now };
  }

  private async recordWithDemandObservation(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    await this.lockSnapshots([{ organizationId, sku: command.sku, locationId }]);
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    await this.observeWindowCloseOnWrite(command.sku, organizationId, locationUuid);
    return this.record(movementType, command);
  }

  private async observeWindowCloseOnWrite(
    sku: Sku,
    organizationId: OrganizationId,
    locationUuid: string,
  ): Promise<void> {
    const row = this.lockedSnapshot(organizationId, sku, locationUuid);
    const demand = demandOf(row);
    const observed = observeWindowClose(demand, this.clock.now());
    if (observed.stickyLocked !== demand.stickyLocked) {
      await this.writeDemand(organizationId, sku, locationUuid, row, observed);
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
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);

    const conflicts = await this.findConflictingMovements(
      organizationId,
      locationId,
      movementType,
      command,
    );
    if (conflicts.existing !== undefined) {
      if (
        movementMatchesCommand(conflicts.existing, movementType, command, locationId, organizationId)
      ) {
        return { ok: true, movement: conflicts.existing };
      }
      return { ok: false, reason: "idempotency_conflict" };
    }
    if (conflicts.provenanceTaken) {
      return { ok: false, reason: "provenance_conflict" };
    }

    const row = this.lockedSnapshot(organizationId, command.sku, locationUuid);
    const current = freezeStockFigures(row.onHand, row.onOrder, row.allocated);
    const demand = demandOf(row);
    const deltaResult = computeSnapshotDelta(
      movementType,
      command.quantity,
      current,
      demand.committed,
    );
    if (!deltaResult.ok) {
      return deltaResult;
    }

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
      row,
      deltaResult.delta,
    );

    return { ok: true, movement };
  }

  /**
   * One query answers both "was this exact command already recorded?" and
   * "does this once-only provenance already have a movement?".
   */
  private async findConflictingMovements(
    organizationId: OrganizationId,
    locationId: LocationId,
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<{ existing: Movement | undefined; provenanceTaken: boolean }> {
    const sameIdempotencyKey = eq(stockMovements.idempotencyKey, command.idempotencyKey);
    const sameProvenance = and(
      eq(stockMovements.refType, command.refType),
      eq(stockMovements.refId, command.refId),
      eq(stockMovements.movementType, movementType),
    );
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.organizationId, organizationId),
          eq(stockMovements.sku, command.sku.value),
          isOnceOnlyProvenanceType(movementType)
            ? or(sameIdempotencyKey, sameProvenance)
            : sameIdempotencyKey,
        ),
      );

    const existingRow = rows.find((row) => row.idempotencyKey === command.idempotencyKey);
    const existing: Movement | undefined =
      existingRow === undefined
        ? undefined
        : Object.freeze({
            id: MovementId.parse(existingRow.id),
            organizationId: OrganizationId.parse(existingRow.organizationId),
            sku: command.sku,
            locationId,
            movementType: existingRow.movementType,
            quantity: existingRow.qty,
            refType: existingRow.refType,
            refId: existingRow.refId,
            idempotencyKey: existingRow.idempotencyKey,
            createdAt: existingRow.createdAt,
          });
    return { existing, provenanceTaken: rows.length > 0 };
  }

  private async applySnapshotDelta(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
    row: SnapshotRow,
    delta: SnapshotDelta,
  ): Promise<void> {
    const nextFigures = freezeStockFigures(
      row.onHand + (delta.onHand ?? 0),
      row.onOrder + (delta.onOrder ?? 0),
      row.allocated + (delta.allocated ?? 0),
    );
    const next: SnapshotRow = {
      id: row.id,
      onHand: nextFigures.onHand,
      onOrder: nextFigures.onOrder,
      allocated: nextFigures.allocated,
      committed: row.committed + (delta.committed ?? 0),
      stickyLocked: delta.stickyLocked ?? row.stickyLocked,
      windowOpensAt: delta.windowOpensAt !== undefined ? delta.windowOpensAt : row.windowOpensAt,
      windowClosesAt:
        delta.windowClosesAt !== undefined ? delta.windowClosesAt : row.windowClosesAt,
    };

    await this.db
      .update(stockSnapshots)
      .set({
        onHand: next.onHand,
        onOrder: next.onOrder,
        allocated: next.allocated,
        committed: next.committed,
        stickyLocked: next.stickyLocked,
        windowOpensAt: next.windowOpensAt,
        windowClosesAt: next.windowClosesAt,
        updatedAt: new Date(),
      })
      .where(eq(stockSnapshots.id, row.id));
    this.rememberRow(organizationId, sku, locationUuid, next);
  }

  private async writeDemand(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
    row: SnapshotRow,
    demand: DemandPersistedState,
  ): Promise<void> {
    await this.db
      .update(stockSnapshots)
      .set({
        windowOpensAt: demand.windowOpensAt,
        windowClosesAt: demand.windowClosesAt,
        stickyLocked: demand.stickyLocked,
        updatedAt: new Date(),
      })
      .where(eq(stockSnapshots.id, row.id));
    this.rememberRow(organizationId, sku, locationUuid, { ...row, ...demand });
  }

  private figuresOf(row: SnapshotRow, now: Date): DemandStockFigures {
    return projectDemandFigures(
      freezeStockFigures(row.onHand, row.onOrder, row.allocated),
      demandOf(row),
      now,
    );
  }

  private lockedSnapshot(organizationId: OrganizationId, sku: Sku, locationUuid: string): SnapshotRow {
    const row = this.lockedRows.get(snapshotKey(organizationId, sku.value, locationUuid));
    if (row === undefined) {
      throw new Error("Locked inventory snapshot is missing");
    }
    return row;
  }

  private rememberRow(
    organizationId: OrganizationId,
    sku: Sku,
    locationUuid: string,
    row: SnapshotRow,
  ): void {
    this.lockedRows.set(snapshotKey(organizationId, sku.value, locationUuid), row);
  }
}
