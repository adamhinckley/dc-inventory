import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { AppDrizzle, SqlClient } from "../infrastructure/db.js";
import type { DemoSeedDeadline } from "./demo-seed-deadline.js";
import type { DemoSeedProgressReporter } from "./demo-seed-progress.js";
import type { DemoBookPlan } from "./planner/types.js";
import type { Phase1SeedSecrets } from "./run-phase1-seed.js";
import { runAssertDemoBookOnDb } from "./run-assert-demo-book-on-db.js";
import { runReplayDemoOrdersOnDb } from "./run-replay-demo-orders-on-db.js";
import { runAssertCustomerAccountingShowcaseOnDb } from "./run-assert-customer-accounting-showcase-on-db.js";
import { runReplayCustomerAccountingOnDb } from "./run-replay-customer-accounting-on-db.js";
import { runReplayPaymentsOnDb } from "./run-replay-payments-on-db.js";
import { runWriteReorderPoliciesOnDb } from "./run-write-reorder-policies-on-db.js";
import { runWriteStaticDemoBookOnDb } from "./run-write-static-demo-book-on-db.js";
import type { DemoReconciliationExpectations } from "./reconciliation/expectations.js";
import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "./reconciliation/expectations.js";
import type { DemoReconciliationResult } from "./reconciliation/contracts.js";
import type { CustomerAccountingShowcaseAssertionResult } from "./assert-customer-accounting-showcase.js";

export type RunDemoSeedOnDbInput = {
  db: AppDrizzle;
  sql: SqlClient;
  plan: DemoBookPlan;
  secrets: Phase1SeedSecrets;
  onProgress?: DemoSeedProgressReporter;
  deadline?: DemoSeedDeadline;
  expectations?: DemoReconciliationExpectations;
  persistCatalog?: boolean;
};

export type RunDemoSeedOnDbResult = {
  staffUserId: StaffUserId;
  reconciliation: DemoReconciliationResult;
  showcaseAssertion: CustomerAccountingShowcaseAssertionResult;
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
  const assertWithinBudget = (): void => {
    input.deadline?.assertWithinBudget();
  };

  tick(input, "static master data");
  const persistCatalog = input.persistCatalog !== false;
  const staticResult = await runWriteStaticDemoBookOnDb(
    input.db,
    input.plan,
    input.secrets,
    { persistCatalog },
  );

  if (!persistCatalog) {
    input.deadline?.assertWithinBudget();
    return {
      staffUserId: staticResult.staff.id,
      reconciliation: { ok: true },
      showcaseAssertion: { ok: true },
      elapsedMs: Date.now() - startedAt,
    };
  }

  tick(input, "order playback");
  await runReplayDemoOrdersOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
    assertWithinBudget,
  });

  tick(input, "payment playback");
  await runReplayPaymentsOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
    assertWithinBudget,
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

  tick(input, "customer accounting playback");
  const showcaseReplay = await runReplayCustomerAccountingOnDb(input.db, input.plan, {
    staffUserId: staticResult.staff.id,
    assertWithinBudget,
  });

  tick(input, "customer accounting showcase validation");
  const showcaseAssertion = await runAssertCustomerAccountingShowcaseOnDb(input.db, {
    showcaseCustomerId: showcaseReplay.showcaseCustomerId,
    asOf: input.plan.seedToday,
  });
  if (!showcaseAssertion.ok) {
    throw new Error(showcaseAssertion.message);
  }

  input.deadline?.assertWithinBudget();

  return {
    staffUserId: staticResult.staff.id,
    reconciliation,
    showcaseAssertion,
    elapsedMs: Date.now() - startedAt,
  };
}
