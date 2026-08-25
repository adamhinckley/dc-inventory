import { DrizzleSupplierRepository } from "@dc-inventory/purchasing";
import type { StaffUserId } from "@dc-inventory/shared-kernel";
import { SeedPlaybackClock } from "../adapters/seed-playback-clock.js";
import { PostgresInventoryUnitOfWork } from "../adapters/postgres-inventory-unit-of-work.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import {
  productNameBySkuFromPlan,
  runReplayPurchaseOrders,
  supplierIdByKeyFromPlan,
  type ReplayPurchaseOrdersResult,
} from "./replay-purchase-orders.js";

export async function runReplayPurchaseOrdersOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: { staffUserId: StaffUserId },
): Promise<ReplayPurchaseOrdersResult> {
  const firstInstant = plan.purchaseOrders[0]?.plannedInstant ?? plan.seedToday;
  const clock = new SeedPlaybackClock(firstInstant);
  const uow = new PostgresInventoryUnitOfWork(db, clock);
  const suppliers = new DrizzleSupplierRepository(db as never);

  return uow.run(async (scope) =>
    runReplayPurchaseOrders(
      { uow: scope.purchasing, clock },
      {
        plan,
        supplierIdByKey: await supplierIdByKeyFromPlan(plan, suppliers),
        productNameBySku: productNameBySkuFromPlan(plan),
        staffUserId: input.staffUserId,
      },
    ),
  );
}
