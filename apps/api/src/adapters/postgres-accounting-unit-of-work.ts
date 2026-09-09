import { AsyncLocalStorage } from "node:async_hooks";
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

const activeInvoicesStore = new AsyncLocalStorage<IAccountingRepository>();

/**
 * Postgres-backed accounting unit of work for payment recording.
 * Each callback runs in its own transaction. ADA-357 use cases read
 * `this.unitOfWork.invoices` inside `run()`, so the transaction-scoped
 * repository is bound per async context (safe for singleton UoW instances).
 */
export class PostgresAccountingUnitOfWork implements AccountingUnitOfWorkWithCustomerPayments {
  private readonly poolInvoices: IAccountingRepository;

  constructor(private readonly db: AppDrizzle) {
    this.poolInvoices = new DrizzleInvoiceRepository(this.db as unknown as AccountingDrizzle);
  }

  get invoices(): IAccountingRepository {
    return activeInvoicesStore.getStore() ?? this.poolInvoices;
  }

  run<T>(work: (uow: AccountingUnitOfWorkWithCustomerPayments) => Promise<T>): Promise<T> {
    return retryAfterIdempotencyRace(
      () =>
        this.db.transaction(async (tx) => {
          const txInvoices = new DrizzleInvoiceRepository(tx as unknown as AccountingDrizzle);
          return activeInvoicesStore.run(txInvoices, async () => {
            const scope: AccountingUnitOfWorkWithCustomerPayments = {
              invoices: txInvoices,
              run: (innerWork) =>
                this.runOnTransaction(tx as unknown as AccountingDrizzle, innerWork),
            };
            return await work(scope);
          });
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
