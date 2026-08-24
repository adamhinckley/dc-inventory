import type { IAccountingUnitOfWork } from "../domain/ports/invoice-repository.js";
import { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.js";

export class InMemoryAccountingUnitOfWork implements IAccountingUnitOfWork {
  readonly invoices = new InMemoryInvoiceRepository();
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() => work(this));
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
