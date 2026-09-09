import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  type AccountingUnitOfWorkWithCustomerPayments,
  type IAccountingRepository,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";
import {
  PAYMENT_IDEMPOTENCY_CONSTRAINTS,
  retryAfterIdempotencyRace,
} from "./postgres-idempotency-race.js";

/**
 * Postgres-backed accounting unit of work for payment recording.
 * Each callback runs in its own transaction. Payment use cases lock their
 * invoice row before checking and appending applications.
 */
export class PostgresAccountingUnitOfWork implements AccountingUnitOfWorkWithCustomerPayments {
  readonly invoices: IAccountingRepository;

  constructor(private readonly db: AppDrizzle) {
    this.invoices = new DrizzleInvoiceRepository(this.db as unknown as AccountingDrizzle);
  }

  run<T>(work: (uow: AccountingUnitOfWorkWithCustomerPayments) => Promise<T>): Promise<T> {
    return retryAfterIdempotencyRace(
      () =>
        this.db.transaction(async (tx) =>
          this.runOnTransaction(tx as unknown as AccountingDrizzle, work),
        ),
      PAYMENT_IDEMPOTENCY_CONSTRAINTS,
    );
  }

  private async runOnTransaction<T>(
    tx: AccountingDrizzle,
    work: (uow: AccountingUnitOfWorkWithCustomerPayments) => Promise<T>,
  ): Promise<T> {
    const invoices = new DrizzleInvoiceRepository(tx);
    const scope: AccountingUnitOfWorkWithCustomerPayments = {
      invoices,
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }
}
