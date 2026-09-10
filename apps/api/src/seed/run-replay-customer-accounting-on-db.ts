import { DrizzleInvoiceRepository } from "@dc-inventory/accounting";
import { DrizzleCustomerRepository } from "@dc-inventory/customers";
import type { StaffUserId } from "@dc-inventory/shared-kernel";
import { PostgresAccountingUnitOfWork } from "../adapters/postgres-accounting-unit-of-work.js";
import { SeedPlaybackClock } from "../adapters/seed-playback-clock.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import {
  runReplayCustomerAccounting,
  type ReplayCustomerAccountingResult,
} from "./replay-customer-accounting.js";

export async function runReplayCustomerAccountingOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: { staffUserId: StaffUserId; assertWithinBudget?: () => void },
): Promise<ReplayCustomerAccountingResult> {
  const clock = new SeedPlaybackClock(plan.seedToday);
  const accountingUow = new PostgresAccountingUnitOfWork(db);
  const customers = new DrizzleCustomerRepository(db as never);
  const invoices = new DrizzleInvoiceRepository(db as never);

  return runReplayCustomerAccounting(
    { accountingUow, clock, customers, invoices },
    {
      plan,
      staffUserId: input.staffUserId,
      assertWithinBudget: input.assertWithinBudget,
    },
  );
}
