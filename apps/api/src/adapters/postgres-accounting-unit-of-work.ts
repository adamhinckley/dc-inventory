import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  type IAccountingUnitOfWork,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";

/**
 * Postgres-backed accounting unit of work for payment recording.
 * Each callback runs in its own transaction. Payment use cases lock their
 * invoice row before checking and appending applications.
 */
export class PostgresAccountingUnitOfWork implements IAccountingUnitOfWork {
  constructor(private readonly db: AppDrizzle) {}

  get invoices(): IAccountingUnitOfWork["invoices"] {
    throw new Error("Access accounting repositories inside accountingUnitOfWork.run");
  }

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) =>
      this.runOnTransaction(tx as AccountingDrizzle, work),
    );
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
