import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { Movement, MovementRefType, MovementType } from "../domain/movement.js";
import type {
  IInventoryReadModel,
  MovementListFilter,
} from "../domain/ports/stock-ledger.js";
import {
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "../domain/snapshot.js";

type SnapshotKey = string;

function snapshotKey(
  organizationId: OrganizationId,
  sku: Sku,
  locationId: LocationId,
): SnapshotKey {
  return `${organizationId}:${sku.value}:${locationId}`;
}

function resolveOrganizationId(organizationId?: OrganizationId): OrganizationId {
  return organizationId ?? OrganizationId.DEFAULT;
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
  private readonly snapshots = new Map<SnapshotKey, StockFigures>();
  private readonly movements: Movement[] = [];
  private readonly byIdempotency = new Map<string, Movement>();
  private readonly byProvenance = new Set<string>();

  /** Test-only seam: seed snapshot state without going through the ledger. */
  seedSnapshot(
    sku: Sku,
    locationId: LocationId,
    figures: StockFigures,
    organizationId?: OrganizationId,
  ): void {
    const org = resolveOrganizationId(organizationId);
    this.snapshots.set(snapshotKey(org, sku, locationId), Object.freeze({ ...figures }));
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

  findMovementByIdempotency(
    organizationId: OrganizationId,
    idempotencyKey: string,
    sku: Sku,
  ): Movement | undefined {
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
    organizationId?: OrganizationId,
  ): StockFigures {
    const org = resolveOrganizationId(organizationId);
    const existing = this.snapshots.get(snapshotKey(org, sku, locationId));
    if (existing) {
      return Object.freeze({ ...existing });
    }
    return ZERO_STOCK_FIGURES;
  }

  async getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId?: OrganizationId,
  ): Promise<StockFigures> {
    return this.getSnapshotSync(sku, locationId, organizationId);
  }

  async listMovements(filter?: MovementListFilter): Promise<readonly Movement[]> {
    const organizationId =
      filter?.organizationId === undefined
        ? undefined
        : resolveOrganizationId(filter.organizationId);
    const sku = filter?.sku;
    const locationId = filter?.locationId;
    return this.movements.filter((movement) => {
      if (organizationId && movement.organizationId !== organizationId) {
        return false;
      }
      if (sku && !movement.sku.equals(sku)) {
        return false;
      }
      if (locationId && movement.locationId !== locationId) {
        return false;
      }
      return true;
    });
  }

  cloneSnapshots(): Map<SnapshotKey, StockFigures> {
    return new Map(this.snapshots);
  }

  cloneMovements(): Movement[] {
    return this.movements.slice();
  }

  restoreSnapshots(snapshots: Map<SnapshotKey, StockFigures>): void {
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
    delta: Partial<Pick<StockFigures, "onHand" | "onOrder" | "allocated">>,
    organizationId?: OrganizationId,
  ): void {
    const org = resolveOrganizationId(organizationId);
    const current = this.snapshots.get(snapshotKey(org, sku, locationId)) ?? ZERO_STOCK_FIGURES;
    this.snapshots.set(
      snapshotKey(org, sku, locationId),
      freezeStockFigures(
        current.onHand + (delta.onHand ?? 0),
        current.onOrder + (delta.onOrder ?? 0),
        current.allocated + (delta.allocated ?? 0),
      ),
    );
  }
}
