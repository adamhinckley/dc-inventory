import {
  InvalidIdError,
  InvalidSkuError,
  LocationId,
  OrganizationId,
  requireOrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IClock } from "../domain/clock.js";
import {
  projectDemandFigures,
  ZERO_DEMAND_STATE,
  type DemandPersistedState,
  type DemandStockFigures,
} from "../domain/demand-model.js";
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

function resolveOrganizationId(organizationId: OrganizationId | undefined): OrganizationId {
  return requireOrganizationId(organizationId);
}

export function isUnknownLocationCodeError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Unknown inventory location code");
}

function toDemandState(row: {
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}): DemandPersistedState {
  return Object.freeze({
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  });
}

export class DrizzleInventoryReadModel implements IInventoryReadModel {
  constructor(
    private readonly db: InventoryReadDrizzle,
    private readonly resolveLocationUuid: (
      organizationId: OrganizationId,
      locationId: LocationId,
    ) => Promise<string>,
    private readonly clock?: IClock,
  ) {}

  async getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): Promise<DemandStockFigures> {
    const org = resolveOrganizationId(organizationId);
    const locationUuid = await this.resolveLocationUuid(org, locationId);
    const rows = await this.db
      .select({
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
          eq(stockSnapshots.organizationId, org),
          eq(stockSnapshots.sku, sku.value),
          eq(stockSnapshots.locationId, locationUuid),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      const now = this.clock ? this.clock.now() : new Date();
      return projectDemandFigures(ZERO_STOCK_FIGURES, ZERO_DEMAND_STATE, now);
    }
    const figures = freezeStockFigures(row.onHand, row.onOrder, row.allocated);
    const demand = toDemandState(row);
    const now = this.clock ? this.clock.now() : new Date();
    return projectDemandFigures(figures, demand, now);
  }

  async getDemandState(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): Promise<DemandPersistedState> {
    const org = resolveOrganizationId(organizationId);
    const locationUuid = await this.resolveLocationUuid(org, locationId);
    const rows = await this.db
      .select({
        committed: stockSnapshots.committed,
        stickyLocked: stockSnapshots.stickyLocked,
        windowOpensAt: stockSnapshots.windowOpensAt,
        windowClosesAt: stockSnapshots.windowClosesAt,
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
    return row === undefined ? ZERO_DEMAND_STATE : toDemandState(row);
  }

  async listMovements(filter: MovementListFilter): Promise<readonly Movement[]> {
    const organizationId = resolveOrganizationId(filter.organizationId);
    const conditions = [eq(stockMovements.organizationId, organizationId)];
    if (filter.sku) {
      conditions.push(eq(stockMovements.sku, filter.sku.value));
    }
    if (filter.movementType) {
      conditions.push(eq(stockMovements.movementType, filter.movementType));
    }
    if (filter.refType) {
      conditions.push(eq(stockMovements.refType, filter.refType));
    }
    if (filter.refId) {
      conditions.push(eq(stockMovements.refId, filter.refId));
    }
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(and(...conditions));
    const movements: Movement[] = [];
    for (const row of rows) {
      if (filter.sku && row.sku !== filter.sku.value) {
        continue;
      }
      const rowOrganizationId = OrganizationId.parse(row.organizationId);
      const rowLocationId = filter.locationId ?? LocationId.DEFAULT;
      if (filter.locationId !== undefined) {
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
      try {
        movements.push(this.toMovement(row, rowLocationId, rowOrganizationId));
      } catch (error) {
        if (error instanceof InvalidSkuError || error instanceof InvalidIdError) {
          continue;
        }
        throw error;
      }
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
