import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  type IAccountingUnitOfWork,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";

/**
 * Postgres-backed accounting unit of work for payment recording.
 */
export class PostgresAccountingUnitOfWork implements IAccountingUnitOfWork {
  constructor(private readonly db: AppDrizzle) {}

  readonly invoices = null as unknown as IAccountingUnitOfWork["invoices"];

  run<T>(work: (uow: IAccountingUnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const scope: IAccountingUnitOfWork = {
        invoices: new DrizzleInvoiceRepository(tx as AccountingDrizzle),
        run: (innerWork) => this.run(innerWork),
      };
      return work(scope);
    });
  }
}
