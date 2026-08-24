import { LocationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { Movement } from "../domain/movement.js";
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

function snapshotKey(sku: Sku, locationId: LocationId): SnapshotKey {
  return `${sku.value}:${locationId}`;
}

/**
 * In-memory read model for tests. Returns immutable snapshots; missing rows read as zero.
 * Snapshot projection updates are implemented in a later packet — this adapter does not
 * derive figures from movements yet.
 */
export class InMemoryInventoryReadModel implements IInventoryReadModel {
  private readonly snapshots = new Map<SnapshotKey, StockFigures>();
  private readonly movements: Movement[] = [];

  /** Test-only seam: seed snapshot state without going through the ledger. */
  seedSnapshot(sku: Sku, locationId: LocationId, figures: StockFigures): void {
    this.snapshots.set(snapshotKey(sku, locationId), Object.freeze({ ...figures }));
  }

  /** Called by the in-memory ledger stub to expose recorded movements. */
  appendMovement(movement: Movement): void {
    this.movements.push(Object.freeze({ ...movement }));
  }

  async getSnapshot(sku: Sku, locationId: LocationId): Promise<StockFigures> {
    const existing = this.snapshots.get(snapshotKey(sku, locationId));
    if (existing) {
      return Object.freeze({ ...existing });
    }
    return ZERO_STOCK_FIGURES;
  }

  async listMovements(filter?: MovementListFilter): Promise<readonly Movement[]> {
    const sku = filter?.sku;
    const locationId = filter?.locationId;
    return this.movements.filter((movement) => {
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
    return new Map(
      [...this.snapshots.entries()].map(([key, value]) => [key, Object.freeze({ ...value })]),
    );
  }

  cloneMovements(): Movement[] {
    return this.movements.map((movement) => Object.freeze({ ...movement }));
  }

  restoreSnapshots(snapshots: Map<SnapshotKey, StockFigures>): void {
    this.snapshots.clear();
    for (const [key, value] of snapshots) {
      this.snapshots.set(key, Object.freeze({ ...value }));
    }
  }

  restoreMovements(movements: Movement[]): void {
    this.movements.length = 0;
    this.movements.push(...movements.map((movement) => Object.freeze({ ...movement })));
  }

  applySnapshotDelta(
    sku: Sku,
    locationId: LocationId,
    delta: Partial<Pick<StockFigures, "onHand" | "onOrder" | "allocated">>,
  ): void {
    const current = this.snapshots.get(snapshotKey(sku, locationId)) ?? ZERO_STOCK_FIGURES;
    this.snapshots.set(
      snapshotKey(sku, locationId),
      freezeStockFigures(
        current.onHand + (delta.onHand ?? 0),
        current.onOrder + (delta.onOrder ?? 0),
        current.allocated + (delta.allocated ?? 0),
      ),
    );
  }
}
