import { LocationId, OrganizationId, requireOrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import {
  projectDemandFigures,
  ZERO_DEMAND_STATE,
  type DemandPersistedState,
  type DemandStockFigures,
} from "../domain/demand-model.js";
import type { Movement, MovementRefType, MovementType } from "../domain/movement.js";
import type {
  IInventoryReadModel,
  MovementListFilter,
} from "../domain/ports/stock-ledger.js";
import type { SnapshotDelta } from "../domain/ledger-rules.js";
import {
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "../domain/snapshot.js";

type SnapshotKey = string;

type StoredSnapshot = Readonly<{
  organizationId: OrganizationId;
  sku: Sku;
  locationId: LocationId;
  figures: StockFigures;
  demand: DemandPersistedState;
}>;

function snapshotKey(
  organizationId: OrganizationId,
  sku: Sku,
  locationId: LocationId,
): SnapshotKey {
  return `${organizationId}:${sku.value}:${locationId}`;
}

function freezeStoredSnapshot(
  organizationId: OrganizationId,
  sku: Sku,
  locationId: LocationId,
  figures: StockFigures,
  demand: DemandPersistedState,
): StoredSnapshot {
  return Object.freeze({
    organizationId,
    sku,
    locationId,
    figures: Object.freeze({ ...figures }),
    demand: Object.freeze({ ...demand }),
  });
}

function defaultStoredSnapshot(
  organizationId: OrganizationId,
  sku: Sku,
  locationId: LocationId,
): StoredSnapshot {
  return freezeStoredSnapshot(
    organizationId,
    sku,
    locationId,
    ZERO_STOCK_FIGURES,
    ZERO_DEMAND_STATE,
  );
}

function resolveOrganizationId(organizationId: OrganizationId | undefined): OrganizationId {
  return requireOrganizationId(organizationId);
}

function idempotencyIndexKey(
  organizationId: OrganizationId,
  idempotencyKey: string,
  sku: Sku,
): string {
  return `${organizationId}:${idempotencyKey}:${sku.value}`;
}

function provenanceIndexKey(
  organizationId: OrganizationId,
  refType: MovementRefType,
  refId: string,
  sku: Sku,
  movementType: MovementType,
): string {
  return `${organizationId}:${refType}:${refId}:${sku.value}:${movementType}`;
}

/**
 * In-memory read model for tests. Returns immutable snapshots; missing rows read as zero.
 *
 * Lookups are keyed maps. Unit-of-work rollback truncates the append-only
 * movement list instead of cloning it, so demo seed playback stays linear.
 */
export class InMemoryInventoryReadModel implements IInventoryReadModel {
  private readonly snapshots = new Map<SnapshotKey, StoredSnapshot>();
  private readonly movements: Movement[] = [];
  private readonly byIdempotency = new Map<string, Movement>();
  private readonly byProvenance = new Set<string>();

  constructor(private readonly clock?: IClock) {}

  /** Test-only seam: seed snapshot state without going through the ledger. */
  seedSnapshot(
    sku: Sku,
    locationId: LocationId,
    figures: StockFigures,
    organizationId: OrganizationId,
    demand: DemandPersistedState = ZERO_DEMAND_STATE,
  ): void {
    const org = resolveOrganizationId(organizationId);
    this.snapshots.set(
      snapshotKey(org, sku, locationId),
      freezeStoredSnapshot(org, sku, locationId, figures, demand),
    );
  }

  appendMovement(movement: Movement): void {
    const frozen = Object.freeze({ ...movement });
    this.movements.push(frozen);
    this.byIdempotency.set(
      idempotencyIndexKey(frozen.organizationId, frozen.idempotencyKey, frozen.sku),
      frozen,
    );
    this.byProvenance.add(
      provenanceIndexKey(
        frozen.organizationId,
        frozen.refType,
        frozen.refId,
        frozen.sku,
        frozen.movementType,
      ),
    );
  }

  movementCount(): number {
    return this.movements.length;
  }

  truncateMovements(length: number): void {
    while (this.movements.length > length) {
      const movement = this.movements.pop();
      if (movement === undefined) {
        return;
      }
      this.byIdempotency.delete(
        idempotencyIndexKey(movement.organizationId, movement.idempotencyKey, movement.sku),
      );
      this.byProvenance.delete(
        provenanceIndexKey(
          movement.organizationId,
          movement.refType,
          movement.refId,
          movement.sku,
          movement.movementType,
        ),
      );
    }
  }

  async findMovementByIdempotency(
    organizationId: OrganizationId,
    idempotencyKey: string,
    sku: Sku,
  ): Promise<Movement | undefined> {
    return this.byIdempotency.get(idempotencyIndexKey(organizationId, idempotencyKey, sku));
  }

  hasProvenance(
    organizationId: OrganizationId,
    refType: MovementRefType,
    refId: string,
    sku: Sku,
    movementType: MovementType,
  ): boolean {
    return this.byProvenance.has(
      provenanceIndexKey(organizationId, refType, refId, sku, movementType),
    );
  }

  getSnapshotSync(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): DemandStockFigures {
    const org = resolveOrganizationId(organizationId);
    const stored =
      this.snapshots.get(snapshotKey(org, sku, locationId)) ??
      defaultStoredSnapshot(org, sku, locationId);
    const now = this.clock ? this.clock.now() : new Date();
    return projectDemandFigures(stored.figures, stored.demand, now);
  }

  getDemandStateSync(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): DemandPersistedState {
    const org = resolveOrganizationId(organizationId);
    const stored =
      this.snapshots.get(snapshotKey(org, sku, locationId)) ??
      defaultStoredSnapshot(org, sku, locationId);
    return stored.demand;
  }

  async getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): Promise<DemandStockFigures> {
    return this.getSnapshotSync(sku, locationId, organizationId);
  }

  /** Lists projected snapshots for an organization at a location (in-memory list queries). */
  listOrganizationSnapshots(
    organizationId: OrganizationId,
    locationId: LocationId = LocationId.DEFAULT,
  ): ReadonlyArray<{ sku: Sku; snapshot: DemandStockFigures }> {
    const org = resolveOrganizationId(organizationId);
    const rows: { sku: Sku; snapshot: DemandStockFigures }[] = [];
    const now = this.clock ? this.clock.now() : new Date();
    for (const stored of this.snapshots.values()) {
      if (stored.organizationId !== org || stored.locationId !== locationId) {
        continue;
      }
      rows.push({
        sku: stored.sku,
        snapshot: projectDemandFigures(stored.figures, stored.demand, now),
      });
    }
    return rows;
  }

  async listMovements(filter: MovementListFilter): Promise<readonly Movement[]> {
    const organizationId = resolveOrganizationId(filter.organizationId);
    const sku = filter.sku;
    const locationId = filter.locationId;
    return this.movements.filter((movement) => {
      if (movement.organizationId !== organizationId) {
        return false;
      }
      if (sku && !movement.sku.equals(sku)) {
        return false;
      }
      if (locationId && movement.locationId !== locationId) {
        return false;
      }
      if (
        filter.movementTypes !== undefined &&
        filter.movementTypes.length > 0 &&
        !filter.movementTypes.includes(movement.movementType)
      ) {
        return false;
      }
      if (
        (filter.movementTypes === undefined || filter.movementTypes.length === 0) &&
        filter.movementType &&
        movement.movementType !== filter.movementType
      ) {
        return false;
      }
      if (filter.refType && movement.refType !== filter.refType) {
        return false;
      }
      if (filter.refId && movement.refId !== filter.refId) {
        return false;
      }
      return true;
    });
  }

  cloneSnapshots(): Map<SnapshotKey, StoredSnapshot> {
    return new Map(this.snapshots);
  }

  cloneMovements(): Movement[] {
    return this.movements.slice();
  }

  restoreSnapshots(snapshots: Map<SnapshotKey, StoredSnapshot>): void {
    this.snapshots.clear();
    for (const [key, value] of snapshots) {
      this.snapshots.set(key, value);
    }
  }

  restoreMovements(movements: Movement[]): void {
    this.movements.length = 0;
    this.byIdempotency.clear();
    this.byProvenance.clear();
    for (const movement of movements) {
      this.appendMovement(movement);
    }
  }

  applySnapshotDelta(
    sku: Sku,
    locationId: LocationId,
    delta: SnapshotDelta,
    organizationId: OrganizationId,
  ): void {
    const org = resolveOrganizationId(organizationId);
    const key = snapshotKey(org, sku, locationId);
    const current = this.snapshots.get(key) ?? defaultStoredSnapshot(org, sku, locationId);
    const nextFigures = freezeStockFigures(
      current.figures.onHand + (delta.onHand ?? 0),
      current.figures.onOrder + (delta.onOrder ?? 0),
      current.figures.allocated + (delta.allocated ?? 0),
    );
    const nextDemand: DemandPersistedState = Object.freeze({
      committed: current.demand.committed + (delta.committed ?? 0),
      stickyLocked: delta.stickyLocked ?? current.demand.stickyLocked,
      windowOpensAt:
        delta.windowOpensAt !== undefined ? delta.windowOpensAt : current.demand.windowOpensAt,
      windowClosesAt:
        delta.windowClosesAt !== undefined ? delta.windowClosesAt : current.demand.windowClosesAt,
    });
    this.snapshots.set(
      key,
      freezeStoredSnapshot(org, sku, locationId, nextFigures, nextDemand),
    );
  }

  setDemandState(
    sku: Sku,
    locationId: LocationId,
    demand: DemandPersistedState,
    organizationId: OrganizationId,
  ): void {
    const org = resolveOrganizationId(organizationId);
    const key = snapshotKey(org, sku, locationId);
    const current = this.snapshots.get(key) ?? defaultStoredSnapshot(org, sku, locationId);
    this.snapshots.set(
      key,
      freezeStoredSnapshot(org, sku, locationId, current.figures, demand),
    );
  }
}
