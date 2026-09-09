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
 * Each callback runs in its own transaction. ADA-357 use cases read
 * `this.unitOfWork.invoices` inside `run()`, so `activeInvoices` is set to the
 * transaction-scoped repository for the duration of the callback.
 */
export class PostgresAccountingUnitOfWork implements AccountingUnitOfWorkWithCustomerPayments {
  private readonly poolInvoices: IAccountingRepository;
  private activeInvoices: IAccountingRepository | null = null;

  constructor(private readonly db: AppDrizzle) {
    this.poolInvoices = new DrizzleInvoiceRepository(this.db as unknown as AccountingDrizzle);
  }

  get invoices(): IAccountingRepository {
    return this.activeInvoices ?? this.poolInvoices;
  }

  run<T>(work: (uow: AccountingUnitOfWorkWithCustomerPayments) => Promise<T>): Promise<T> {
    return retryAfterIdempotencyRace(
      () =>
        this.db.transaction(async (tx) => {
          const previous = this.activeInvoices;
          const txInvoices = new DrizzleInvoiceRepository(tx as unknown as AccountingDrizzle);
          this.activeInvoices = txInvoices;
          try {
            const scope: AccountingUnitOfWorkWithCustomerPayments = {
              invoices: txInvoices,
              run: (innerWork) =>
                this.runOnTransaction(tx as unknown as AccountingDrizzle, innerWork),
            };
            return await work(scope);
          } finally {
            this.activeInvoices = previous;
          }
        }),
      PAYMENT_IDEMPOTENCY_CONSTRAINTS,
    );
  }

  private async runOnTransaction<T>(
    tx: AccountingDrizzle,
    work: (uow: AccountingUnitOfWorkWithCustomerPayments) => Promise<T>,
  ): Promise<T> {
    const scope: AccountingUnitOfWorkWithCustomerPayments = {
      invoices: this.invoices,
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }
}
