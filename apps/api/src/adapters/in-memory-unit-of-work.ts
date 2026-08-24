import { InMemoryInventoryUnitOfWork } from "@dc-inventory/inventory";
import type { IUnitOfWork } from "../domain/unit-of-work.js";

/** Composition-root in-memory unit of work for tests and local wiring. */
export class InMemoryUnitOfWork implements IUnitOfWork {
  private readonly inner = new InMemoryInventoryUnitOfWork();

  readonly inventory = {
    ledger: this.inner.ledger,
    readModel: this.inner.readModel,
  };

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.inner.run((scope) =>
      work({
        inventory: scope,
        run: (innerWork) => this.run(innerWork),
      }),
    );
  }
}
