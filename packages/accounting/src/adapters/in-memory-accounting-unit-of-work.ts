import type {
  IAccountingRepository,
  IAccountingUnitOfWork,
} from "../domain/ports/invoice-repository.js";
import { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.js";

export class InMemoryAccountingUnitOfWork implements IAccountingUnitOfWork {
  readonly invoices: IAccountingRepository;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(invoices?: IAccountingRepository) {
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
