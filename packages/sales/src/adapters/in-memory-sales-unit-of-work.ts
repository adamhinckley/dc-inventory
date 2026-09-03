import {
  CreateInvoiceForOrderAdapter,
  InMemoryInvoiceRepository,
  type ICustomerBillToSnapshotReadPort,
  type ICustomerTermsReadPort,
} from "@dc-inventory/accounting";
import {
  InMemoryInventoryUnitOfWork,
  StockLedgerInventoryCommandAdapter,
} from "@dc-inventory/inventory";
import type { IClock } from "../domain/clock.js";
import type { IAccountingCommandPort } from "../domain/ports/sales-order-repository.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import { InMemorySalesOrderRepository } from "./in-memory-sales-order-repository.js";

export class InMemorySalesUnitOfWork implements ISalesUnitOfWork {
  readonly salesOrders = new InMemorySalesOrderRepository();
  readonly invoices = new InMemoryInvoiceRepository();
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: StockLedgerInventoryCommandAdapter;
  readonly accounting: IAccountingCommandPort;

  constructor(
    billToSnapshot: ICustomerBillToSnapshotReadPort,
    customerTerms: ICustomerTermsReadPort,
    clock?: IClock,
  ) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = new StockLedgerInventoryCommandAdapter(
      this.inventoryUow.ledger,
      this.inventoryUow.readModel,
    );
    this.accounting = new CreateInvoiceForOrderAdapter(
      this.invoices,
      billToSnapshot,
      customerTerms,
      clock,
    );
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
