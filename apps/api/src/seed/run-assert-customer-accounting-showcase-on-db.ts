import {
  DrizzleInvoiceRepository,
  InMemoryArCustomerReadPort,
} from "@dc-inventory/accounting";
import {
  DrizzleLastOrderDateReadAdapter,
  DrizzleOpenOrderExposureReadAdapter,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import type { CustomerId } from "@dc-inventory/shared-kernel";
import { DrizzleCustomerArProfileReadPort } from "../adapters/accounting-customer-ar-profile-read.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import {
  assertCustomerAccountingShowcase,
  type CustomerAccountingShowcaseAssertionResult,
} from "./assert-customer-accounting-showcase.js";

export async function runAssertCustomerAccountingShowcaseOnDb(
  db: AppDrizzle,
  input: { showcaseCustomerId: CustomerId; asOf: Date },
): Promise<CustomerAccountingShowcaseAssertionResult> {
  const accountingRepository = new DrizzleInvoiceRepository(db as never);
  const salesDb = db as unknown as SalesDrizzle;

  return assertCustomerAccountingShowcase(
    {
      arCustomerRead: new InMemoryArCustomerReadPort(accountingRepository),
      customerProfiles: new DrizzleCustomerArProfileReadPort(db),
      openOrderExposure: new DrizzleOpenOrderExposureReadAdapter(salesDb),
      lastOrderDate: new DrizzleLastOrderDateReadAdapter(salesDb),
    },
    {
      customerId: input.showcaseCustomerId,
      asOf: input.asOf,
    },
  );
}
