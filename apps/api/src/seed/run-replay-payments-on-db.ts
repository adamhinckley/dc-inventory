import { DrizzleInvoiceRepository } from "@dc-inventory/accounting";
import { DrizzleSalesOrderRepository } from "@dc-inventory/sales";
import type { StaffUserId } from "@dc-inventory/shared-kernel";
import { PostgresAccountingUnitOfWork } from "../adapters/postgres-accounting-unit-of-work.js";
import { SeedPlaybackClock } from "../adapters/seed-playback-clock.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import {
  runReplayPayments,
  type ReplayPaymentsResult,
} from "./replay-payments.js";

/**
 * Postgres wiring for payment replay. Each payment runs in its own accounting
 * transaction via `PostgresAccountingUnitOfWork`.
 */
export async function runReplayPaymentsOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: { staffUserId: StaffUserId },
): Promise<ReplayPaymentsResult> {
  const paidInstant =
    plan.shippedInvoices.find((row) => row.paid)?.plannedInstant ?? plan.seedToday;
  const clock = new SeedPlaybackClock(paidInstant);
  const accountingUow = new PostgresAccountingUnitOfWork(db);
  const salesOrders = new DrizzleSalesOrderRepository(db as never);
  const invoices = new DrizzleInvoiceRepository(db as never);

  return runReplayPayments(
    { accountingUow, clock, salesOrders, invoices },
    {
      plan,
      staffUserId: input.staffUserId,
    },
  );
}
