import {
  DrizzleInvoiceRepository,
  InMemoryArCustomerReadPort,
  type AccountingDrizzle,
  type IArCustomerReadPort,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";

export function createArCustomerReadPort(db: AppDrizzle): IArCustomerReadPort {
  return new InMemoryArCustomerReadPort(
    new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle),
  );
}
