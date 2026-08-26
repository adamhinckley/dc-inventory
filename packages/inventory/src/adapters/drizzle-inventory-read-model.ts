import { LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
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

function resolveOrganizationId(organizationId?: OrganizationId): OrganizationId {
  return organizationId ?? OrganizationId.DEFAULT;
}

export function isUnknownLocationCodeError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Unknown inventory location code");
}

export class DrizzleInventoryReadModel implements IInventoryReadModel {
  constructor(
    private readonly db: InventoryReadDrizzle,
    private readonly resolveLocationUuid: (
      organizationId: OrganizationId,
      locationId: LocationId,
    ) => Promise<string>,
  ) {}

  async getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId?: OrganizationId,
  ): Promise<ReturnType<typeof freezeStockFigures>> {
    const org = resolveOrganizationId(organizationId);
    const locationUuid = await this.resolveLocationUuid(org, locationId);
    const rows = await this.db
      .select({
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        allocated: stockSnapshots.allocated,
      })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.organizationId, org),
          eq(stockSnapshots.sku, sku.value),
          eq(stockSnapshots.locationId, locationUuid),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return ZERO_STOCK_FIGURES;
    }
    return freezeStockFigures(row.onHand, row.onOrder, row.allocated);
  }

  async listMovements(filter?: MovementListFilter): Promise<readonly Movement[]> {
    const organizationId =
      filter?.organizationId === undefined
        ? undefined
        : resolveOrganizationId(filter.organizationId);
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(
        organizationId === undefined
          ? undefined
          : eq(stockMovements.organizationId, organizationId),
      );
    const movements: Movement[] = [];
    for (const row of rows) {
      if (filter?.sku && row.sku !== filter.sku.value) {
        continue;
      }
      const rowOrganizationId = OrganizationId.parse(row.organizationId);
      const rowLocationId = filter?.locationId ?? LocationId.DEFAULT;
      if (filter?.locationId !== undefined) {
        let locationUuid: string;
        try {
          locationUuid = await this.resolveLocationUuid(
            rowOrganizationId,
            filter.locationId,
          );
        } catch (error) {
          if (!isUnknownLocationCodeError(error)) {
            throw error;
          }
          continue;
        }
        if (row.locationId !== locationUuid) {
          continue;
        }
      }
      movements.push(this.toMovement(row, rowLocationId, rowOrganizationId));
    }
    return movements;
  }

  async findMovementByIdempotency(
    organizationId: OrganizationId,
    idempotencyKey: string,
    sku: Sku,
  ): Promise<Movement | undefined> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.organizationId, organizationId),
          eq(stockMovements.idempotencyKey, idempotencyKey),
          eq(stockMovements.sku, sku.value),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row === undefined
      ? undefined
      : this.toMovement(row, LocationId.DEFAULT, organizationId);
  }

  async hasProvenance(
    organizationId: OrganizationId,
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
          eq(stockMovements.organizationId, organizationId),
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
    organizationId?: OrganizationId,
  ): Movement {
    return Object.freeze({
      id: MovementId.parse(row.id),
      organizationId: OrganizationId.parse(row.organizationId),
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
