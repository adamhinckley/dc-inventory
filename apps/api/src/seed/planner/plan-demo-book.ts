import {
  DEFAULT_DEMO_SEED,
  FULL_DEMO_COUNTS,
  PERSONA_ORDER_BUDGETS,
  type DemoCounts,
  type PersonaOrderBudgets,
} from "./constants.js";
import { demoHistoricalStart } from "./dates.js";
import {
  assertNamedCustomerPins,
  assertPhase1FixturesPreserved,
  planCustomersAndShipTos,
  planIdentityEmails,
  planProducts,
  planSupplierProducts,
  planSuppliers,
} from "./master-data.js";
import {
  chooseLeftoverPurchaseOrderCount,
  planPurchaseOrders,
} from "./purchase-orders.js";
import { planShippedInvoices } from "./payments.js";
import {
  chooseLeftoverSalesOrderCounts,
  planIdleParkAges,
  planSalesOrders,
} from "./sales-orders.js";
import { alignDemoPlanStockClock } from "./align-stock-clock.js";
import { createSeededRandom, type SeededRandom } from "./seeded-random.js";
import type { DemoBookPlan, PlanDemoBookInput } from "./types.js";

type PlanDemoBookOptions = PlanDemoBookInput & {
  counts?: DemoCounts;
  personaOrderBudgets?: PersonaOrderBudgets;
};

function scopedRandom(seed: string, label: string): SeededRandom {
  return createSeededRandom(`${seed}:${label}`);
}

export function planDemoBook(input: PlanDemoBookOptions): DemoBookPlan {
  const seed = input.seed ?? DEFAULT_DEMO_SEED;
  const seedToday = input.seedToday;
  const historicalStart = demoHistoricalStart(seedToday);
  const counts = input.counts ?? FULL_DEMO_COUNTS;
  const personaOrderBudgets = input.personaOrderBudgets ?? PERSONA_ORDER_BUDGETS;

  const products = planProducts(scopedRandom(seed, "products"), counts);
  assertPhase1FixturesPreserved(products);

  const suppliers = planSuppliers(scopedRandom(seed, "suppliers"), counts);
  const supplierProducts = planSupplierProducts(products, suppliers, counts);
  const { customers, shipTos } = planCustomersAndShipTos(
    scopedRandom(seed, "customers"),
    counts,
  );
  assertNamedCustomerPins(customers);
  const identity = planIdentityEmails();

  const leftoverConfirmedPurchaseOrderCount = chooseLeftoverPurchaseOrderCount(
    scopedRandom(seed, "po-leftover-count"),
    counts,
  );
  const purchaseOrders = planPurchaseOrders({
    rng: scopedRandom(seed, "purchase-orders"),
    seedToday,
    historicalStart,
    suppliers,
    supplierProducts,
    leftoverConfirmedCount: leftoverConfirmedPurchaseOrderCount,
    counts,
  });

  const leftoverConfirmedSalesOrderCount = chooseLeftoverSalesOrderCounts(
    scopedRandom(seed, "so-leftover-count"),
    counts,
  );
  const salesOrders = planSalesOrders({
    rng: scopedRandom(seed, "sales-orders"),
    seedToday,
    historicalStart,
    customers,
    shipTos,
    products,
    leftoverConfirmedCount: leftoverConfirmedSalesOrderCount,
    counts,
    personaOrderBudgets,
  });

  const idleParkShipped = salesOrders.filter(
    (row) => row.customerKey === "idlePark" && row.status === "shipped",
  );
  const idleParkInstants = planIdleParkAges({
    rng: scopedRandom(seed, "idle-park-ages"),
    seedToday,
    idleParkShippedOrders: idleParkShipped,
    currentOrderKey: counts.salesOrders > 20 ? "so-idle-current" : null,
  });
  if (counts.salesOrders <= 20) {
    for (const order of idleParkShipped) {
      const instant = idleParkInstants.get(order.key);
      if (instant !== undefined) {
        order.plannedInstant = instant;
      }
    }
  }

  const shippedInvoices = planShippedInvoices({
    salesOrders,
    customers,
    seedToday,
    idleParkInstants,
    counts,
  });

  const plan: DemoBookPlan = {
    seed,
    seedToday,
    historicalStart,
    master: {
      products,
      suppliers,
      supplierProducts,
      customers,
      shipTos,
      staffEmail: identity.staffEmail,
      wholesaleEmail: identity.wholesaleEmail,
      wholesaleCustomerKey: identity.wholesaleCustomerKey,
    },
    purchaseOrders,
    salesOrders,
    shippedInvoices,
    leftoverConfirmedPurchaseOrderCount,
    leftoverConfirmedSalesOrderCount,
  };
  alignDemoPlanStockClock(plan);
  return plan;
}

export { DEFAULT_DEMO_SEED } from "./constants.js";
export { createSeededRandom } from "./seeded-random.js";
export { replayEqual, replayFingerprint, toReplayComparablePlan } from "./replay-equality.js";
export type { DemoBookPlan, PlanDemoBookInput, ReplayComparablePlan } from "./types.js";
