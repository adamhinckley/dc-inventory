import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  type IAccountingUnitOfWork,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";
import {
  PAYMENT_IDEMPOTENCY_CONSTRAINTS,
  retryAfterIdempotencyRace,
} from "./postgres-idempotency-race.js";

/**
 * Postgres-backed accounting unit of work for payment recording.
 * Serializes callers and runs each callback in one Drizzle transaction.
 */
export class PostgresAccountingUnitOfWork implements IAccountingUnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: AppDrizzle) {}

  get invoices(): IAccountingUnitOfWork["invoices"] {
    throw new Error("Access accounting repositories inside accountingUnitOfWork.run");
  }

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() =>
      retryAfterIdempotencyRace(
        () =>
          this.db.transaction(async (tx) =>
            this.runOnTransaction(tx as AccountingDrizzle, work),
          ),
        PAYMENT_IDEMPOTENCY_CONSTRAINTS,
      ),
    );
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async runOnTransaction<T>(
    tx: AccountingDrizzle,
    work: (uow: IAccountingUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const invoices = new DrizzleInvoiceRepository(tx);
    const scope: IAccountingUnitOfWork = {
      invoices,
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }
}
