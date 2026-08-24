import { LocationId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { MovementId } from "../domain/ids.js";
import type { Movement, MovementRefType, MovementType } from "../domain/movement.js";
import type {
  IInventoryReadModel,
  MovementListFilter,
} from "../domain/ports/stock-ledger.js";
import { freezeStockFigures, ZERO_STOCK_FIGURES } from "../domain/snapshot.js";
import { stockMovements, stockSnapshots } from "../persistence/schema.js";

export type InventoryReadDrizzle = PostgresJsDatabase<{
  stockMovements: typeof stockMovements;
  stockSnapshots: typeof stockSnapshots;
}>;

export class DrizzleInventoryReadModel implements IInventoryReadModel {
  constructor(
    private readonly db: InventoryReadDrizzle,
    private readonly resolveLocationUuid: (locationId: LocationId) => Promise<string>,
  ) {}

  async getSnapshot(sku: Sku, locationId: LocationId): Promise<ReturnType<typeof freezeStockFigures>> {
    const locationUuid = await this.resolveLocationUuid(locationId);
    const rows = await this.db
      .select({
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        allocated: stockSnapshots.allocated,
      })
      .from(stockSnapshots)
      .where(and(eq(stockSnapshots.sku, sku.value), eq(stockSnapshots.locationId, locationUuid)))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return ZERO_STOCK_FIGURES;
    }
    return freezeStockFigures(row.onHand, row.onOrder, row.allocated);
  }

  async listMovements(filter?: MovementListFilter): Promise<readonly Movement[]> {
    const rows = await this.db.select().from(stockMovements);
    const locationUuid =
      filter?.locationId === undefined
        ? undefined
        : await this.resolveLocationUuid(filter.locationId);
    return rows
      .filter((row) => {
        if (filter?.sku && row.sku !== filter.sku.value) {
          return false;
        }
        if (locationUuid && row.locationId !== locationUuid) {
          return false;
        }
        return true;
      })
      .map((row) => this.toMovement(row, filter?.locationId ?? LocationId.DEFAULT));
  }

  async findMovementByIdempotency(
    idempotencyKey: string,
    sku: Sku,
  ): Promise<Movement | undefined> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.idempotencyKey, idempotencyKey), eq(stockMovements.sku, sku.value)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? undefined : this.toMovement(row, LocationId.DEFAULT);
  }

  async hasProvenance(
    refType: MovementRefType,
    refId: string,
    sku: Sku,
    movementType: MovementType,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.refType, refType),
          eq(stockMovements.refId, refId),
          eq(stockMovements.sku, sku.value),
          eq(stockMovements.movementType, movementType),
        ),
      )
      .limit(1);
    return rows[0] !== undefined;
  }

  private toMovement(
    row: typeof stockMovements.$inferSelect,
    locationId: LocationId,
  ): Movement {
    return Object.freeze({
      id: MovementId.parse(row.id),
      sku: Sku.parse(row.sku),
      locationId,
      movementType: row.movementType,
      quantity: row.qty,
      refType: row.refType,
      refId: row.refId,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
    });
  }
}
