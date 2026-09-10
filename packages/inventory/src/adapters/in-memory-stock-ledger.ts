import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import {
  allocateReceiveCover,
  RECEIVE_COVER_MOVEMENT_TYPES,
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
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

type BulkRecordState = {
  pendingMovements: Movement[];
  snapshotsBefore: ReturnType<InMemoryInventoryReadModel["cloneSnapshots"]>;
  movementsBefore: ReturnType<InMemoryInventoryReadModel["cloneMovements"]>;
};

const EMPTY_BULK_SUCCESS: StockCommandResult = { ok: true };

function provenanceConflictKey(
  refType: Movement["refType"],
  refId: string,
  sku: string,
  movementType: MovementType,
): string {
  return `${refType}\0${refId}\0${sku}\0${movementType}`;
}

/**
 * In-memory stock ledger. Records append-only movements and projects snapshots
 * in the same unit of work scope as the read model.
 */
export class InMemoryStockLedger implements IStockLedger {
  private singleRecordCallCount = 0;
  private applyRecordCallCount = 0;

  constructor(
    private readonly readModel: InMemoryInventoryReadModel,
    private readonly clock?: IClock,
  ) {}

  /** Counts invocations of the single-row `record()` path (for bulk I/O tests). */
  getSingleRecordCallCount(): number {
    return this.singleRecordCallCount;
  }

  resetSingleRecordCallCount(): void {
    this.singleRecordCallCount = 0;
  }

  /** Counts internal `applyRecord` calls issued by bulk paths. */
  getApplyRecordCallCount(): number {
    return this.applyRecordCallCount;
  }

  resetApplyRecordCallCount(): void {
    this.applyRecordCallCount = 0;
  }

  lockSnapshots(_snapshots: readonly StockSnapshotLock[]): Promise<void> {
    return Promise.resolve();
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

  recordInboundFromPoBulk(
    commands: readonly RecordInboundFromPoCommand[],
  ): Promise<StockCommandResult> {
    return this.recordBulkWithDemandObservation("InboundFromPo", commands);
  }

  recordGoodsReceivedBulk(
    commands: readonly RecordGoodsReceivedCommand[],
  ): Promise<StockCommandResult> {
    return this.runGoodsReceivedBulkWithCover(commands);
  }

  recordInboundCancelledBulk(
    commands: readonly RecordInboundCancelledCommand[],
  ): Promise<StockCommandResult> {
    return this.recordBulkWithDemandObservation("InboundCancelled", commands);
  }

  recordCommittedBulk(commands: readonly RecordCommittedCommand[]): Promise<StockCommandResult> {
    return this.runCommittedBulkWithCover(commands);
  }

  recordDecommittedBulk(commands: readonly RecordDecommittedCommand[]): Promise<StockCommandResult> {
    return this.recordBulkWithDemandObservation("Decommitted", commands);
  }

  recordDeallocatedBulk(commands: readonly RecordDeallocatedCommand[]): Promise<StockCommandResult> {
    return this.recordBulkWithDemandObservation("Deallocated", commands);
  }

  recordShippedBulk(commands: readonly RecordShippedCommand[]): Promise<StockCommandResult> {
    return this.recordBulkWithDemandObservation("Shipped", commands);
  }

  async reopenSkusForPresell(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const windowOpensAt = command.windowOpensAt ?? null;
    const windowClosesAt = command.windowClosesAt ?? null;
    if (isSellWindowInvalid(windowOpensAt, windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    for (const sku of command.skus) {
      const demand = this.readModel.getDemandStateSync(sku, LocationId.DEFAULT, organizationId);
      const reopened: DemandPersistedState = Object.freeze({
        committed: demand.committed,
        stickyLocked: false,
        windowOpensAt,
        windowClosesAt,
      });
      this.readModel.setDemandState(sku, LocationId.DEFAULT, reopened, organizationId);
    }
    return { ok: true };
  }

  async closeSkusForPresell(command: CloseSkusForPresellCommand): Promise<CloseSkusForPresellResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const now = this.clock ? this.clock.now() : new Date();
    let closedCount = 0;

    for (const sku of command.skus) {
      const demand = this.readModel.getDemandStateSync(sku, LocationId.DEFAULT, organizationId);
      if (demand.stickyLocked) {
        continue;
      }
      const nextDemand = applySetSellWindow(demand, demand.windowOpensAt, now, now);
      if (!nextDemand.stickyLocked) {
        continue;
      }
      this.readModel.setDemandState(sku, LocationId.DEFAULT, nextDemand, organizationId);
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

    const demand = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const now = this.clock ? this.clock.now() : new Date();
    const nextDemand = applySetSellWindow(
      demand,
      command.windowOpensAt,
      command.windowClosesAt,
      now,
    );
    this.readModel.setDemandState(command.sku, locationId, nextDemand, organizationId);
    return { ok: true };
  }

  private async runCommittedWithCover(
    command: RecordCommittedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    const now = this.clock ? this.clock.now() : new Date();

    const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const observedDemand = observeWindowClose(demandBefore, now);
    if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
      this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
    }

    return recordCommittedWithCover(command, {
      readState: () => ({
        figures: this.readModel.getSnapshotSync(command.sku, locationId, organizationId),
        demand: this.readModel.getDemandStateSync(command.sku, locationId, organizationId),
        now,
      }),
      record: (movementType, coverCommand) => this.record(movementType, coverCommand),
    });
  }

  private async runCommittedBulkWithCover(
    commands: readonly RecordCommittedCommand[],
  ): Promise<StockCommandResult> {
    if (commands.length === 0) {
      return EMPTY_BULK_SUCCESS;
    }
    await this.lockSnapshots(
      commands.map((command) => ({
        organizationId: requireOrganizationId(command.organizationId),
        sku: command.sku,
        locationId: command.locationId ?? LocationId.DEFAULT,
      })),
    );
    const bulkState = this.createBulkState();
    const observedSkus = new Set<string>();
    let lastSuccess: Extract<StockCommandResult, { ok: true }> | undefined;
    for (const command of commands) {
      const organizationId = requireOrganizationId(command.organizationId);
      const locationId = command.locationId ?? LocationId.DEFAULT;
      const now = this.clock ? this.clock.now() : new Date();
      const skuKey = `${organizationId}\0${command.sku.value}\0${locationId}`;
      if (!observedSkus.has(skuKey)) {
        observedSkus.add(skuKey);
        const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
        const observedDemand = observeWindowClose(demandBefore, now);
        if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
          this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
        }
      }
      const result = await recordCommittedWithCover(command, {
        readState: () => ({
          figures: this.readModel.getSnapshotSync(command.sku, locationId, organizationId),
          demand: this.readModel.getDemandStateSync(command.sku, locationId, organizationId),
          now,
        }),
        record: (movementType, coverCommand) =>
          this.applyRecord(movementType, coverCommand, bulkState),
      });
      if (!result.ok) {
        this.rollbackBulkState(bulkState);
        return { ...result, failedIdempotencyKey: command.idempotencyKey };
      }
      lastSuccess = result;
    }
    return lastSuccess ?? { ok: false, reason: "invalid_quantity" };
  }

  private async runGoodsReceivedWithCover(
    command: RecordGoodsReceivedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    const now = this.clock ? this.clock.now() : new Date();

    const receiveResult = await this.recordWithDemandObservation("GoodsReceived", command);
    if (!receiveResult.ok) {
      return receiveResult;
    }

    const coverResult = await allocateReceiveCover(command, command.quantity, {
      readState: () => ({
        figures: this.readModel.getSnapshotSync(command.sku, locationId, organizationId),
        demand: this.readModel.getDemandStateSync(command.sku, locationId, organizationId),
        now,
      }),
      listMovements: async () =>
        (await this.readModel.listMovements({
          organizationId,
          sku: command.sku,
          locationId,
          refType: "sales_order",
          movementTypes: RECEIVE_COVER_MOVEMENT_TYPES,
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

  private async runGoodsReceivedBulkWithCover(
    commands: readonly RecordGoodsReceivedCommand[],
  ): Promise<StockCommandResult> {
    if (commands.length === 0) {
      return EMPTY_BULK_SUCCESS;
    }
    await this.lockSnapshots(
      commands.map((command) => ({
        organizationId: requireOrganizationId(command.organizationId),
        sku: command.sku,
        locationId: command.locationId ?? LocationId.DEFAULT,
      })),
    );
    const bulkState = this.createBulkState();
    const observedSkus = new Set<string>();
    let lastSuccess: Extract<StockCommandResult, { ok: true }> | undefined;
    for (const command of commands) {
      const organizationId = requireOrganizationId(command.organizationId);
      const locationId = command.locationId ?? LocationId.DEFAULT;
      const now = this.clock ? this.clock.now() : new Date();
      const skuKey = `${organizationId}\0${command.sku.value}\0${locationId}`;
      if (!observedSkus.has(skuKey)) {
        observedSkus.add(skuKey);
        const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
        const observedDemand = observeWindowClose(demandBefore, now);
        if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
          this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
        }
      }
      const receiveResult = await this.applyRecord("GoodsReceived", command, bulkState);
      if (!receiveResult.ok) {
        this.rollbackBulkState(bulkState);
        return { ...receiveResult, failedIdempotencyKey: command.idempotencyKey };
      }
      const coverResult = await allocateReceiveCover(command, command.quantity, {
        readState: () => ({
          figures: this.readModel.getSnapshotSync(command.sku, locationId, organizationId),
          demand: this.readModel.getDemandStateSync(command.sku, locationId, organizationId),
          now,
        }),
        listMovements: async () =>
          (await this.readModel.listMovements({
            organizationId,
            sku: command.sku,
            locationId,
            refType: "sales_order",
            movementTypes: RECEIVE_COVER_MOVEMENT_TYPES,
          })).map((movement) => ({
            movementType: movement.movementType,
            quantity: movement.quantity,
            refType: movement.refType,
            refId: movement.refId,
            createdAt: movement.createdAt,
          })),
        record: (movementType, coverCommand) =>
          this.applyRecord(movementType, coverCommand, bulkState),
      });
      if (coverResult !== null && !coverResult.ok) {
        this.rollbackBulkState(bulkState);
        return { ...coverResult, failedIdempotencyKey: command.idempotencyKey };
      }
      lastSuccess = receiveResult;
    }
    return lastSuccess ?? { ok: false, reason: "invalid_quantity" };
  }

  private async recordBulkWithDemandObservation(
    movementType: MovementType,
    commands: readonly StockCommandBase[],
  ): Promise<StockCommandResult> {
    if (commands.length === 0) {
      return EMPTY_BULK_SUCCESS;
    }
    await this.lockSnapshots(
      commands.map((command) => ({
        organizationId: requireOrganizationId(command.organizationId),
        sku: command.sku,
        locationId: command.locationId ?? LocationId.DEFAULT,
      })),
    );
    const bulkState = this.createBulkState();
    const observedSkus = new Set<string>();
    let lastSuccess: Extract<StockCommandResult, { ok: true }> | undefined;
    for (const command of commands) {
      const organizationId = requireOrganizationId(command.organizationId);
      const locationId = command.locationId ?? LocationId.DEFAULT;
      const now = this.clock ? this.clock.now() : new Date();
      const skuKey = `${organizationId}\0${command.sku.value}\0${locationId}`;
      if (!observedSkus.has(skuKey)) {
        observedSkus.add(skuKey);
        const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
        const observedDemand = observeWindowClose(demandBefore, now);
        if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
          this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
        }
      }
      const result = await this.applyRecord(movementType, command, bulkState);
      if (!result.ok) {
        this.rollbackBulkState(bulkState);
        return { ...result, failedIdempotencyKey: command.idempotencyKey };
      }
      lastSuccess = result;
    }
    return lastSuccess ?? { ok: false, reason: "invalid_quantity" };
  }

  private createBulkState(): BulkRecordState {
    return {
      pendingMovements: [],
      snapshotsBefore: this.readModel.cloneSnapshots(),
      movementsBefore: this.readModel.cloneMovements(),
    };
  }

  private rollbackBulkState(bulkState: BulkRecordState): void {
    this.readModel.restoreSnapshots(bulkState.snapshotsBefore);
    this.readModel.restoreMovements(bulkState.movementsBefore);
    bulkState.pendingMovements.length = 0;
  }

  private recordWithDemandObservation(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    const now = this.clock ? this.clock.now() : new Date();
    const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const observedDemand = observeWindowClose(demandBefore, now);
    if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
      this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
    }
    return this.record(movementType, command);
  }

  private record(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    this.singleRecordCallCount += 1;
    return this.applyRecord(movementType, command);
  }

  private checkBulkConflicts(
    bulkState: BulkRecordState,
    movementType: MovementType,
    command: StockCommandBase,
    organizationId: OrganizationId,
    locationId: LocationId,
  ): StockCommandResult | null {
    const pendingReplay = bulkState.pendingMovements.find(
      (movement) =>
        movement.organizationId === organizationId &&
        movement.sku.equals(command.sku) &&
        movement.idempotencyKey === command.idempotencyKey,
    );
    if (pendingReplay !== undefined) {
      if (
        movementMatchesCommand(pendingReplay, movementType, command, locationId, organizationId)
      ) {
        return { ok: true, movement: pendingReplay };
      }
      return { ok: false, reason: "idempotency_conflict" };
    }

    if (isOnceOnlyProvenanceType(movementType)) {
      const provenanceKey = provenanceConflictKey(
        command.refType,
        command.refId,
        command.sku.value,
        movementType,
      );
      if (
        bulkState.pendingMovements.some(
          (movement) =>
            movement.movementType === movementType &&
            provenanceConflictKey(
              movement.refType,
              movement.refId,
              movement.sku.value,
              movement.movementType,
            ) === provenanceKey,
        )
      ) {
        return { ok: false, reason: "provenance_conflict" };
      }
    }

    return null;
  }

  private applyRecord(
    movementType: MovementType,
    command: StockCommandBase,
    bulkState?: BulkRecordState,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    if (!isPositiveIntegerQuantity(command.quantity)) {
      return Promise.resolve({ ok: false, reason: "invalid_quantity" });
    }

    if (bulkState !== undefined) {
      this.applyRecordCallCount += 1;
      const bulkConflict = this.checkBulkConflicts(
        bulkState,
        movementType,
        command,
        organizationId,
        locationId,
      );
      if (bulkConflict !== null) {
        return Promise.resolve(bulkConflict);
      }
    }

    const existing = this.readModel.findMovementByIdempotency(
      organizationId,
      command.idempotencyKey,
      command.sku,
    );
    if (existing) {
      if (movementMatchesCommand(existing, movementType, command, locationId, organizationId)) {
        return Promise.resolve({ ok: true, movement: existing });
      }
      return Promise.resolve({ ok: false, reason: "idempotency_conflict" });
    }

    if (
      isOnceOnlyProvenanceType(movementType) &&
      this.readModel.hasProvenance(
        organizationId,
        command.refType,
        command.refId,
        command.sku,
        movementType,
      )
    ) {
      return Promise.resolve({ ok: false, reason: "provenance_conflict" });
    }

    const current = this.readModel.getSnapshotSync(command.sku, locationId, organizationId);
    const demand = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const deltaResult = computeSnapshotDelta(
      movementType,
      command.quantity,
      current,
      demand.committed,
    );
    if (!deltaResult.ok) {
      return Promise.resolve(deltaResult);
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
      createdAt: this.clock ? new Date(this.clock.now().getTime()) : new Date(),
    });

    this.readModel.appendMovement(movement);
    this.readModel.applySnapshotDelta(command.sku, locationId, deltaResult.delta, organizationId);
    if (bulkState !== undefined) {
      bulkState.pendingMovements.push(movement);
    }
    return Promise.resolve({ ok: true, movement });
  }
}
