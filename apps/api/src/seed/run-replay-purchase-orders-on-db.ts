import {
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierRepository,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
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

/**
 * Postgres wiring for PO replay. Create uses Drizzle repos on the pool; confirm/receive
 * run in per-command transactions via `PostgresInventoryUnitOfWork` (not one outer tx).
 */
export async function runReplayPurchaseOrdersOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: { staffUserId: StaffUserId },
): Promise<ReplayPurchaseOrdersResult> {
  const firstInstant = plan.purchaseOrders[0]?.plannedInstant ?? plan.seedToday;
  const clock = new SeedPlaybackClock(firstInstant);
  const postgresUow = new PostgresInventoryUnitOfWork(db, clock);
  const purchaseOrders = new DrizzlePurchaseOrderRepository(db as never);
  const suppliers = new DrizzleSupplierRepository(db as never);

  const purchasingUow: IPurchasingUnitOfWork = {
    purchaseOrders,
    suppliers,
    get inventory(): never {
      throw new Error("inventory commands are only available inside purchasing.run");
    },
    run: (work) => postgresUow.run((scope) => work(scope.purchasing)),
  };

  return runReplayPurchaseOrders(
    { uow: purchasingUow, clock },
    {
      plan,
      supplierIdByKey: await supplierIdByKeyFromPlan(plan, suppliers),
      productNameBySku: productNameBySkuFromPlan(plan),
      staffUserId: input.staffUserId,
    },
  );
}
