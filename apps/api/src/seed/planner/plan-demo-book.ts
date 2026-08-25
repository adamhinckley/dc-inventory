import { DEFAULT_DEMO_SEED } from "./constants.js";
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
import { createSeededRandom, type SeededRandom } from "./seeded-random.js";
import type { DemoBookPlan, PlanDemoBookInput } from "./types.js";

function scopedRandom(seed: string, label: string): SeededRandom {
  return createSeededRandom(`${seed}:${label}`);
}

export function planDemoBook(input: PlanDemoBookInput): DemoBookPlan {
  const seed = input.seed ?? DEFAULT_DEMO_SEED;
  const seedToday = input.seedToday;
  const historicalStart = demoHistoricalStart(seedToday);

  const products = planProducts(scopedRandom(seed, "products"));
  assertPhase1FixturesPreserved(products);

  const suppliers = planSuppliers(scopedRandom(seed, "suppliers"));
  const supplierProducts = planSupplierProducts(products, suppliers);
  const { customers, shipTos } = planCustomersAndShipTos(scopedRandom(seed, "customers"));
  assertNamedCustomerPins(customers);
  const identity = planIdentityEmails();

  const leftoverConfirmedPurchaseOrderCount = chooseLeftoverPurchaseOrderCount(
    scopedRandom(seed, "po-leftover-count"),
  );
  const purchaseOrders = planPurchaseOrders({
    rng: scopedRandom(seed, "purchase-orders"),
    seedToday,
    historicalStart,
    suppliers,
    supplierProducts,
    leftoverConfirmedCount: leftoverConfirmedPurchaseOrderCount,
  });

  const leftoverConfirmedSalesOrderCount = chooseLeftoverSalesOrderCounts(
    scopedRandom(seed, "so-leftover-count"),
  );
  const salesOrders = planSalesOrders({
    rng: scopedRandom(seed, "sales-orders"),
    seedToday,
    historicalStart,
    customers,
    shipTos,
    products,
    leftoverConfirmedCount: leftoverConfirmedSalesOrderCount,
  });

  const idleParkShipped = salesOrders.filter(
    (row) => row.customerKey === "idlePark" && row.status === "shipped",
  );
  const idleParkInstants = planIdleParkAges({
    rng: scopedRandom(seed, "idle-park-ages"),
    seedToday,
    idleParkShippedOrders: idleParkShipped,
    currentOrderKey: "so-idle-current",
  });

  const shippedInvoices = planShippedInvoices({
    salesOrders,
    customers,
    seedToday,
    idleParkInstants,
  });

  return {
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
}

export { DEFAULT_DEMO_SEED } from "./constants.js";
export { createSeededRandom } from "./seeded-random.js";
export { replayEqual, replayFingerprint, toReplayComparablePlan } from "./replay-equality.js";
export type { DemoBookPlan, PlanDemoBookInput, ReplayComparablePlan } from "./types.js";
