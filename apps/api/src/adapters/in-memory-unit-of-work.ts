import type { IClock } from "@dc-inventory/inventory";
import { InMemoryInventoryUnitOfWork } from "@dc-inventory/inventory";
import {
  InMemoryInvoiceRepository,
  type ICustomerBillToSnapshotReadPort,
  type ICustomerTermsReadPort,
} from "@dc-inventory/accounting";
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
import { SalesInvoiceAccountingCommandAdapter } from "./sales-accounting-command-port.js";

/**
 * In-memory composition-root unit of work for purchasing, sales, and inventory tests.
 */
export class InMemoryUnitOfWork implements IUnitOfWork {
  readonly suppliers = new InMemorySupplierRepository();
  readonly purchaseOrders = new InMemoryPurchaseOrderRepository(
    async (organizationId, supplierId) => {
      const supplier = await this.suppliers.findById(organizationId, supplierId);
      return supplier?.name ?? "";
    },
    async (organizationId, supplierId) => {
      const supplier = await this.suppliers.findById(organizationId, supplierId);
      return supplier?.poPrefix ?? null;
    },
  );
  readonly salesOrders = new InMemorySalesOrderRepository();
  readonly invoices = new InMemoryInvoiceRepository();
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: {
    ledger: InMemoryInventoryUnitOfWork["ledger"];
    readModel: InMemoryInventoryUnitOfWork["readModel"];
  };
  private readonly purchasingScope: IPurchasingUnitOfWork;
  private readonly salesScope: ISalesUnitOfWork;

  constructor(
    billToSnapshot: ICustomerBillToSnapshotReadPort,
    customerTerms: ICustomerTermsReadPort,
    clock?: IClock,
  ) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = {
      ledger: this.inventoryUow.ledger,
      readModel: this.inventoryUow.readModel,
    };
    const inventoryCommands = new StockLedgerInventoryCommandAdapter(
      this.inventoryUow.ledger,
      this.inventoryUow.readModel,
    );
    this.purchasingScope = {
      purchaseOrders: this.purchaseOrders,
      suppliers: this.suppliers,
      inventory: inventoryCommands,
      run: (work) => this.run((scope) => work(scope.purchasing)),
    };
    this.salesScope = {
      salesOrders: this.salesOrders,
      inventory: inventoryCommands,
      accounting: new SalesInvoiceAccountingCommandAdapter(
        this.invoices,
        billToSnapshot,
        customerTerms,
        clock,
      ),
      run: (work) => this.run((scope) => work(scope.sales)),
    };
  }

  get purchasing(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }

  get sales(): ISalesUnitOfWork {
    return this.salesScope;
  }

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => {
      const salesSnap = this.salesOrders.snapshot();
      const invoiceSnap = this.invoices.snapshot();
      const purchaseOrderSnap = this.purchaseOrders.snapshot();
      try {
        const scope: IUnitOfWork = {
          inventory: this.inventory,
          purchasing: this.purchasingScope,
          sales: this.salesScope,
          run: (innerWork) => this.run(innerWork),
        };
        return await work(scope);
      } catch (error) {
        this.salesOrders.restore(salesSnap);
        this.invoices.restore(invoiceSnap);
        this.purchaseOrders.restore(purchaseOrderSnap);
        throw error;
      }
    });
  }

  get purchasingScopeForTests(): IPurchasingUnitOfWork {
    return this.purchasingScope;
  }
}
