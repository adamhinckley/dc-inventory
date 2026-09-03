import {
  InMemoryInventoryUnitOfWork,
  StockLedgerInventoryCommandAdapter,
} from "@dc-inventory/inventory";
import type { IClock } from "../domain/clock.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import { InMemoryPurchaseOrderRepository } from "./in-memory-purchase-order-repository.js";
import { InMemorySupplierRepository } from "./in-memory-supplier-repository.js";

export class InMemoryPurchasingUnitOfWork implements IPurchasingUnitOfWork {
  readonly suppliers = new InMemorySupplierRepository();
  readonly purchaseOrders = new InMemoryPurchaseOrderRepository(
    async (organizationId, supplierId) => {
      const supplier = await this.suppliers.findById(organizationId, supplierId);
      return supplier?.name ?? "";
    },
  );
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: StockLedgerInventoryCommandAdapter;

  constructor(clock?: IClock) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = new StockLedgerInventoryCommandAdapter(
      this.inventoryUow.ledger,
      this.inventoryUow.readModel,
    );
  }

  run<T>(work: (uow: IPurchasingUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => work(this));
  }

  get inventoryReadModel() {
    return this.inventoryUow.readModel;
  }
}
