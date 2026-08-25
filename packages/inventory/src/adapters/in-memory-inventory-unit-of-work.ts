import type { IClock } from "../domain/clock.js";
import type { IInventoryReadModel, IStockLedger } from "../domain/ports/stock-ledger.js";
import { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";
import { InMemoryStockLedger } from "./in-memory-stock-ledger.js";

export type InventoryUnitOfWorkScope = {
  readonly ledger: IStockLedger;
  readonly readModel: IInventoryReadModel;
};

/**
 * Shared in-memory unit of work for inventory tests. Serializes work and rolls back
 * movements and snapshots when the callback throws.
 */
export class InMemoryInventoryUnitOfWork implements InventoryUnitOfWorkScope {
  readonly readModel: InMemoryInventoryReadModel;
  readonly ledger: InMemoryStockLedger;

  private queue: Promise<unknown> = Promise.resolve();

  constructor(clock?: IClock) {
    this.readModel = new InMemoryInventoryReadModel();
    this.ledger = new InMemoryStockLedger(this.readModel, clock);
  }

  run<T>(work: (scope: InventoryUnitOfWorkScope) => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const snapshotsBefore = this.readModel.cloneSnapshots();
      const movementsBefore = this.readModel.cloneMovements();
      try {
        return await work(this);
      } catch (error) {
        this.readModel.restoreSnapshots(snapshotsBefore);
        this.readModel.restoreMovements(movementsBefore);
        throw error;
      }
    });
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
