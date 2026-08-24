import { InMemoryInventoryUnitOfWork } from "@dc-inventory/inventory";
import {
  InMemoryPurchaseOrderRepository,
  InMemorySupplierRepository,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
import {
  InMemorySalesOrderRepository,
  type ISalesUnitOfWork,
} from "@dc-inventory/sales";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import { StockLedgerInventoryCommandAdapter } from "./inventory-command-port.js";
import { SalesStockLedgerInventoryCommandAdapter } from "./sales-inventory-command-port.js";

/**
 * In-memory composition-root unit of work for purchasing, sales, and inventory tests.
 */
export class InMemoryUnitOfWork implements IUnitOfWork {
  readonly purchaseOrders = new InMemoryPurchaseOrderRepository();
  readonly suppliers = new InMemorySupplierRepository();
  readonly salesOrders = new InMemorySalesOrderRepository();
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

  private readonly salesScope: ISalesUnitOfWork = {
    salesOrders: this.salesOrders,
    inventory: new SalesStockLedgerInventoryCommandAdapter(this.inventoryUow.ledger),
    run: (work) => this.run((scope) => work(scope.sales)),
  };

  get purchasing(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }

  get sales(): ISalesUnitOfWork {
    return this.salesScope;
  }

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => {
      const scope: IUnitOfWork = {
        inventory: this.inventory,
        purchasing: this.purchasingScope,
        sales: this.salesScope,
        run: (innerWork) => this.run(innerWork),
      };
      return work(scope);
    });
  }

  get purchasingScopeForTests(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }
}
