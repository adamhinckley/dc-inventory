import type {
  IInventoryReadModel,
  IStockLedger,
} from "@dc-inventory/inventory";

/**
 * Composition-root unit of work seam. Cross-context orchestration extends this
 * interface in later packets; Phase 2 inventory tests use the inventory scope.
 */
export interface IUnitOfWork {
  readonly inventory: {
    readonly ledger: IStockLedger;
    readonly readModel: IInventoryReadModel;
  };
  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
