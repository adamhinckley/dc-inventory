import type { IAccountingUnitOfWork, IInvoiceRepository } from "../domain/ports/invoice-repository.js";
import { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.js";

export class InMemoryAccountingUnitOfWork implements IAccountingUnitOfWork {
  readonly invoices: IInvoiceRepository;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(invoices?: IInvoiceRepository) {
    this.invoices = invoices ?? new InMemoryInvoiceRepository();
  }

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() => work(this));
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
