import type { IAccountingUnitOfWork, IInvoiceRepository } from "../domain/ports/invoice-repository.js";
import { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.js";

export class InMemoryAccountingUnitOfWork implements IAccountingUnitOfWork {
  readonly invoices = new InMemoryInvoiceRepository();

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    return work(this);
  }
}
