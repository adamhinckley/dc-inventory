import {
  InMemoryInventoryUnitOfWork,
  StockLedgerInventoryCommandAdapter,
} from "@dc-inventory/inventory";
import { InMemoryInvoiceRepository } from "@dc-inventory/accounting";
import type { IClock } from "../domain/clock.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import { AccountingCommandAdapter } from "./accounting-command-adapter.js";
import { InMemorySalesOrderRepository } from "./in-memory-sales-order-repository.js";

export class InMemorySalesUnitOfWork implements ISalesUnitOfWork {
  readonly salesOrders = new InMemorySalesOrderRepository();
  readonly invoices = new InMemoryInvoiceRepository();
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: StockLedgerInventoryCommandAdapter;
  readonly accounting: AccountingCommandAdapter;

  constructor(clock?: IClock) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = new StockLedgerInventoryCommandAdapter(
      this.inventoryUow.ledger,
      this.inventoryUow.readModel,
    );
    this.accounting = new AccountingCommandAdapter(this.invoices, clock);
  }

  run<T>(work: (uow: ISalesUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => {
      const salesSnap = this.salesOrders.snapshot();
      const invoiceSnap = this.invoices.snapshot();
      try {
        return await work(this);
      } catch (error) {
        this.salesOrders.restore(salesSnap);
        this.invoices.restore(invoiceSnap);
        throw error;
      }
    });
  }

  get inventoryReadModel() {
    return this.inventoryUow.readModel;
  }

  get ledger() {
    return this.inventoryUow.ledger;
  }
}
