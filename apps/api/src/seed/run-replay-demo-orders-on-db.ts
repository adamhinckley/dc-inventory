import {
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierRepository,
  type IPurchasingUnitOfWork,
} from "@dc-inventory/purchasing";
import {
  DrizzleSalesOrderRepository,
  type ISalesUnitOfWork,
} from "@dc-inventory/sales";
import { DrizzleCustomerRepository } from "@dc-inventory/customers";
import {
  CustomerTermsReadAdapter,
  DrizzleInvoiceRepository,
} from "@dc-inventory/accounting";
import { DrizzleProductRepository } from "@dc-inventory/catalog";
import type { StaffUserId } from "@dc-inventory/shared-kernel";
import { SeedPlaybackClock } from "../adapters/seed-playback-clock.js";
import { PostgresInventoryUnitOfWork } from "../adapters/postgres-inventory-unit-of-work.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import {
  productNameBySkuFromPlan,
  supplierIdByKeyFromPlan,
} from "./replay-purchase-orders.js";
import {
  currencyBySkuFromPlan,
  customerIdByKeyFromPlan,
  permissiveDemoBillToSnapshotPort,
  taxCategoryBySkuFromPlan,
} from "./replay-sales-orders.js";
import { runReplayDemoOrders, type ReplayDemoOrdersResult } from "./replay-demo-orders.js";

/**
 * Postgres wiring for interleaved PO/SO replay. Commands run in per-command
 * transactions via `PostgresInventoryUnitOfWork` (not one outer tx).
 */
export async function runReplayDemoOrdersOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  input: { staffUserId: StaffUserId; assertWithinBudget?: () => void },
): Promise<ReplayDemoOrdersResult> {
  const firstInstant =
    plan.purchaseOrders[0]?.plannedInstant ??
    plan.salesOrders[0]?.plannedInstant ??
    plan.seedToday;
  const clock = new SeedPlaybackClock(firstInstant);
  const customers = new DrizzleCustomerRepository(db as never);
  const postgresUow = new PostgresInventoryUnitOfWork(
    db,
    clock,
    permissiveDemoBillToSnapshotPort(),
    new CustomerTermsReadAdapter(customers),
  );
  const purchaseOrders = new DrizzlePurchaseOrderRepository(db as never);
  const suppliers = new DrizzleSupplierRepository(db as never);
  const salesOrders = new DrizzleSalesOrderRepository(db as never);
  const invoices = new DrizzleInvoiceRepository(db as never);
  const products = new DrizzleProductRepository(db as never);

  const purchasingUow: IPurchasingUnitOfWork = {
    purchaseOrders,
    suppliers,
    get inventory(): never {
      throw new Error("inventory commands are only available inside purchasing.run");
    },
    run: (work) => postgresUow.run((scope) => work(scope.purchasing)),
  };

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

  return runReplayDemoOrders(
    {
      purchasing: purchasingUow,
      sales: salesUow,
      clock,
      customers,
      products,
      invoices,
      billToSnapshot: permissiveDemoBillToSnapshotPort(),
    },
    {
      plan,
      supplierIdByKey: await supplierIdByKeyFromPlan(plan, suppliers),
      customerIdByKey: await customerIdByKeyFromPlan(plan, customers),
      productNameBySku: productNameBySkuFromPlan(plan),
      currencyBySku: currencyBySkuFromPlan(plan),
      taxCategoryBySku: taxCategoryBySkuFromPlan(plan),
      staffUserId: input.staffUserId,
      assertWithinBudget: input.assertWithinBudget,
    },
  );
}
