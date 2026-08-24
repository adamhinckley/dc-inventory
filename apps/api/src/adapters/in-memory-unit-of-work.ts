import { InMemoryInventoryUnitOfWork } from "@dc-inventory/inventory";
import {
  InMemoryPurchaseOrderRepository,
  InMemorySupplierRepository,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import { StockLedgerInventoryCommandAdapter } from "./inventory-command-port.js";

/**
 * In-memory composition-root unit of work for purchasing + inventory tests.
 */
export class InMemoryUnitOfWork implements IUnitOfWork {
  readonly purchaseOrders = new InMemoryPurchaseOrderRepository();
  readonly suppliers = new InMemorySupplierRepository();
  private readonly inventoryUow = new InMemoryInventoryUnitOfWork();
  readonly inventory = {
    ledger: this.inventoryUow.ledger,
    readModel: this.inventoryUow.readModel,
  };

  private readonly purchasingScope: IPurchasingUnitOfWork = {
    purchaseOrders: this.purchaseOrders,
    suppliers: this.suppliers,
    inventory: new StockLedgerInventoryCommandAdapter(this.inventoryUow.ledger),
    run: (work) => this.run((scope) => work(scope.purchasing)),
  };

  get purchasing(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => {
      const scope: IUnitOfWork = {
        inventory: this.inventory,
        purchasing: this.purchasingScope,
        run: (innerWork) => this.run(innerWork),
      };
      return work(scope);
    });
  }

  get purchasingScopeForTests(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }
}
