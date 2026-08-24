import type { AppDrizzle } from "../infrastructure/db.js";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import {
  DrizzleInventoryReadModel,
  DrizzleStockLedger,
  type InventoryDrizzle,
} from "@dc-inventory/inventory";
import { LocationId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import { locations } from "@dc-inventory/inventory/schema";

/**
 * Postgres-backed inventory unit of work for the composition root.
 * Serializes callers and runs each callback in one Drizzle transaction.
 */
export class PostgresInventoryUnitOfWork implements IUnitOfWork {
  private readonly defaultLocationUuid: Promise<string>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: AppDrizzle) {
    this.defaultLocationUuid = this.loadDefaultLocationUuid();
  }

  readonly inventory = {
    ledger: null as unknown as DrizzleStockLedger,
    readModel: null as unknown as DrizzleInventoryReadModel,
  };

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() =>
      this.db.transaction(async (tx) => this.runOnTransaction(tx as InventoryDrizzle, work)),
    );
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async runOnTransaction<T>(
    tx: InventoryDrizzle,
    work: (uow: IUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const resolveLocationUuid = async (locationId: LocationId): Promise<string> => {
      if (locationId === LocationId.DEFAULT) {
        return this.defaultLocationUuid;
      }
      const rows = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.code, locationId))
        .limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error(`Unknown inventory location code ${locationId}`);
      }
      return id;
    };

    const readModel = new DrizzleInventoryReadModel(tx, resolveLocationUuid);
    const ledger = new DrizzleStockLedger(tx, readModel, resolveLocationUuid);
    const scope: IUnitOfWork = {
      inventory: { ledger, readModel },
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }

  private async loadDefaultLocationUuid(): Promise<string> {
    const rows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.code, LocationId.DEFAULT))
      .limit(1);
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error("DEFAULT inventory location is missing; run Phase 2 bootstrap");
    }
    return id;
  }
}
