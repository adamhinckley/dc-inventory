import {
  DrizzleSalesOrderRepository,
  type ISalesUnitOfWork,
} from "@dc-inventory/sales";
import { DrizzleCustomerRepository } from "@dc-inventory/customers";
import { DrizzleInvoiceRepository } from "@dc-inventory/accounting";
import { DrizzleProductRepository } from "@dc-inventory/catalog";
import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import { SeedPlaybackClock } from "../adapters/seed-playback-clock.js";
import { PostgresInventoryUnitOfWork } from "../adapters/postgres-inventory-unit-of-work.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import {
  currencyBySkuFromPlan,
  customerIdByKeyFromPlan,
  permissiveDemoBillToSnapshotPort,
  productNameBySkuFromPlan,
  runReplaySalesOrders,
  taxCategoryBySkuFromPlan,
  type ReplaySalesOrdersResult,
} from "./replay-sales-orders.js";

/**
 * Postgres wiring for sales replay. Create uses Drizzle repos on the pool; confirm/ship
 * run in per-command transactions via `PostgresInventoryUnitOfWork` (not one outer tx).
 */
export async function runReplaySalesOrdersOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: {
    staffUserId: StaffUserId;
    customerIdByKey: ReadonlyMap<string, CustomerId>;
    assertWithinBudget?: () => void;
  },
): Promise<ReplaySalesOrdersResult> {
  const firstInstant = plan.salesOrders[0]?.plannedInstant ?? plan.seedToday;
  const clock = new SeedPlaybackClock(firstInstant);
  const postgresUow = new PostgresInventoryUnitOfWork(db, clock);
  const salesOrders = new DrizzleSalesOrderRepository(db as never);
  const customers = new DrizzleCustomerRepository(db as never);
  const invoices = new DrizzleInvoiceRepository(db as never);
  const products = new DrizzleProductRepository(db as never);

  const salesUow: ISalesUnitOfWork = {
    salesOrders,
    get inventory(): never {
      throw new Error("inventory commands are only available inside sales.run");
    },
    get accounting(): never {
      throw new Error("accounting commands are only available inside sales.run");
    },
    run: (work) => postgresUow.run((scope) => work(scope.sales)),
  };

  return runReplaySalesOrders(
    {
      uow: salesUow,
      clock,
      customers,
      products,
      invoices,
      billToSnapshot: permissiveDemoBillToSnapshotPort(),
    },
    {
      plan,
      customerIdByKey: input.customerIdByKey,
      productNameBySku: productNameBySkuFromPlan(plan),
      currencyBySku: currencyBySkuFromPlan(plan),
      taxCategoryBySku: taxCategoryBySkuFromPlan(plan),
      staffUserId: input.staffUserId,
      assertWithinBudget: input.assertWithinBudget,
    },
  );
}

export { customerIdByKeyFromPlan };
