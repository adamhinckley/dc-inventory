import { DrizzleCustomerRepository } from "@dc-inventory/customers";
import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { AppDrizzle, SqlClient } from "../infrastructure/db.js";
import type { DemoSeedDeadline } from "./demo-seed-deadline.js";
import type { DemoSeedProgressReporter } from "./demo-seed-progress.js";
import type { DemoBookPlan } from "./planner/types.js";
import type { Phase1SeedSecrets } from "./run-phase1-seed.js";
import { runAssertDemoBookOnDb } from "./run-assert-demo-book-on-db.js";
import { runReplayPaymentsOnDb } from "./run-replay-payments-on-db.js";
import { runReplayPurchaseOrdersOnDb } from "./run-replay-purchase-orders-on-db.js";
import {
  customerIdByKeyFromPlan,
  runReplaySalesOrdersOnDb,
} from "./run-replay-sales-orders-on-db.js";
import { runWriteReorderPoliciesOnDb } from "./run-write-reorder-policies-on-db.js";
import { runWriteStaticDemoBookOnDb } from "./run-write-static-demo-book-on-db.js";
import type { DemoReconciliationExpectations } from "./reconciliation/expectations.js";
import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "./reconciliation/expectations.js";
import type { DemoReconciliationResult } from "./reconciliation/contracts.js";

export type RunDemoSeedOnDbInput = {
  db: AppDrizzle;
  sql: SqlClient;
  plan: DemoBookPlan;
  secrets: Phase1SeedSecrets;
  onProgress?: DemoSeedProgressReporter;
  deadline?: DemoSeedDeadline;
  expectations?: DemoReconciliationExpectations;
};

export type RunDemoSeedOnDbResult = {
  staffUserId: StaffUserId;
  reconciliation: DemoReconciliationResult;
  elapsedMs: number;
};

function tick(
  input: RunDemoSeedOnDbInput,
  stage: Parameters<NonNullable<DemoSeedProgressReporter>>[0],
): void {
  input.deadline?.assertWithinBudget();
  input.onProgress?.(stage);
}

export async function runDemoSeedOnDb(
  input: RunDemoSeedOnDbInput,
): Promise<RunDemoSeedOnDbResult> {
  const startedAt = Date.now();

  tick(input, "static master data");
  const staticResult = await runWriteStaticDemoBookOnDb(input.db, input.plan, input.secrets);

  tick(input, "purchase order playback");
  await runReplayPurchaseOrdersOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
  });

  const customers = new DrizzleCustomerRepository(input.db as never);
  const customerIdByKey = await customerIdByKeyFromPlan(input.plan, customers);

  tick(input, "sales order playback");
  await runReplaySalesOrdersOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
    customerIdByKey,
  });

  tick(input, "payment playback");
  await runReplayPaymentsOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
  });

  tick(input, "reorder policies");
  await runWriteReorderPoliciesOnDb(input.db, input.plan);

  tick(input, "reconciliation");
  const reconciliation = await runAssertDemoBookOnDb(input.db, {
    seedToday: input.plan.seedToday,
    expectations: input.expectations ?? FULL_DEMO_RECONCILIATION_EXPECTATIONS,
  });
  if (!reconciliation.ok) {
    throw new Error(reconciliation.message);
  }

  input.deadline?.assertWithinBudget();

  return {
    staffUserId: staticResult.staff.id,
    reconciliation,
    elapsedMs: Date.now() - startedAt,
  };
}
