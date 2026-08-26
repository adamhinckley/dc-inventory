import { beforeAll, describe, expect, it, vi } from "vitest";
import { PHASE1_PRODUCTS, PHASE1_PRODUCT_SKUS } from "../phase1-fixture.js";
import { DEMO_NAMED_CUSTOMERS, FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "../reconciliation/expectations.js";
import { utcDayDiff, demoArBucket } from "../reconciliation/assert-demo-book.js";
import {
  DEFAULT_DEMO_SEED,
  DEMO_COUNTS,
  PO_LINE_COUNT_MAX,
  PO_LINE_COUNT_MEAN,
  PO_LINE_COUNT_MIN,
  PO_LINE_QTY_MAX,
  PO_LINE_QTY_MEAN,
  PO_LINE_QTY_MIN,
  SO_LINE_COUNT_DEFAULT_MAX,
  SO_LINE_COUNT_DEFAULT_MEAN,
  SO_LINE_COUNT_DEFAULT_MIN,
  SO_LINE_COUNT_IDLE_PARK_MAX,
  SO_LINE_COUNT_IDLE_PARK_MIN,
  SO_LINE_COUNT_NORTHSTAR_MAX,
  SO_LINE_COUNT_NORTHSTAR_MIN,
  SO_LINE_QTY_MAX,
  SO_LINE_QTY_MEAN,
  SO_LINE_QTY_MIN,
} from "./constants.js";
import { mean } from "./corpus-samplers.js";
import { demoHistoricalStart, expectedQ4Fraction, isQ4Month, isWithinLastDays } from "./dates.js";
import { selectPaymentReplay, selectUnpaidReplay } from "./payments.js";
import {
  DEFAULT_DEMO_SEED as EXPORTED_DEFAULT,
  planDemoBook,
  replayEqual,
  replayFingerprint,
  toReplayComparablePlan,
  type DemoBookPlan,
} from "./plan-demo-book.js";
import { demoPlanStockTimelineError } from "./stock-timeline.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");

describe("planDemoBook", () => {
  let plan: DemoBookPlan;

  beforeAll(() => {
    plan = planDemoBook({ seedToday: SEED_TODAY });
  }, 30_000);

  it("defaults DEMO_SEED to dc-inventory-demo-1", () => {
    expect(EXPORTED_DEFAULT).toBe("dc-inventory-demo-1");
    expect(plan.seed).toBe(DEFAULT_DEMO_SEED);
  });

  it("replays the same business fields for the same seed on another seed-today", () => {
    const second = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: new Date("2027-01-15T00:00:00.000Z") });
    expect(replayEqual(toReplayComparablePlan(plan), toReplayComparablePlan(second))).toBe(true);
    expect(plan.seedToday.getTime()).not.toBe(second.seedToday.getTime());
  }, 30_000);

  it("varies replay fields when the seed changes", () => {
    const alternate = planDemoBook({ seed: "dc-inventory-demo-2", seedToday: SEED_TODAY });
    expect(replayFingerprint(plan)).not.toBe(replayFingerprint(alternate));
  }, 30_000);

  it("keeps receive-before-allocate on the seed clock that reconciliation replays", () => {
    expect(demoPlanStockTimelineError(plan)).toBeUndefined();
  });

  it("preserves Phase 1 fixtures and generates DEM-00001..DEM-00795", () => {
    for (const fixture of PHASE1_PRODUCTS) {
      const row = plan.master.products.find((product) => product.sku === fixture.sku);
      expect(row?.name).toBe(fixture.name);
      expect(row?.uom).toBe(fixture.uom);
      expect(row?.memberPriceCents).toBe(fixture.memberPriceCents);
    }
    const generated = plan.master.products.filter((row) => !row.isPhase1Fixture);
    expect(generated).toHaveLength(795);
    expect(generated[0]?.sku).toBe("DEM-00001");
    expect(generated.at(-1)?.sku).toBe("DEM-00795");
    expect(new Set(generated.map((row) => row.name)).size).toBe(795);
  });

  it("plans master-data counts, suppliers, customers, and persona budgets", () => {
    expect(plan.master.products).toHaveLength(DEMO_COUNTS.products);
    expect(plan.master.suppliers).toHaveLength(DEMO_COUNTS.suppliers);
    expect(plan.master.supplierProducts).toHaveLength(DEMO_COUNTS.products);
    expect(plan.master.customers).toHaveLength(DEMO_COUNTS.customers);
    expect(plan.master.shipTos).toHaveLength(DEMO_COUNTS.customers);
    expect(plan.master.customers.filter((row) => row.hasExemptionCertificate)).toHaveLength(48);
    expect(plan.master.staffEmail).toBe("staff@local.test");
    expect(plan.master.wholesaleEmail).toBe("wholesale@local.test");
    expect(plan.master.wholesaleCustomerKey).toBe("acme");

    const counts = new Map<string, number>();
    for (const order of plan.salesOrders) {
      counts.set(order.customerKey, (counts.get(order.customerKey) ?? 0) + 1);
    }
    expect(counts.get("northstar")).toBe(1_500);
    expect(counts.get("harvest")).toBe(450);
    expect(counts.get("idlePark")).toBe(75);
    expect([...counts.values()].reduce((sum, value) => sum + value, 0)).toBe(15_000);

    const acme = plan.master.customers.find((row) => row.key === "acme");
    expect(acme?.name).toBe(DEMO_NAMED_CUSTOMERS.acme.name);
    expect(acme?.creditLimitCents).toBe(DEMO_NAMED_CUSTOMERS.acme.creditLimitCents);
  });

  it("meets PO and SO corpus bands and distinct SKU rules", () => {
    const poLineCounts = plan.purchaseOrders.map((row) => row.lines.length);
    const poQtys = plan.purchaseOrders.flatMap((row) => row.lines.map((line) => line.qty));
    expect(mean(poLineCounts)).toBe(PO_LINE_COUNT_MEAN);
    expect(mean(poQtys)).toBe(PO_LINE_QTY_MEAN);
    expect(poLineCounts.every((count) => count >= PO_LINE_COUNT_MIN && count <= PO_LINE_COUNT_MAX)).toBe(true);
    expect(poQtys.every((qty) => qty >= PO_LINE_QTY_MIN && qty <= PO_LINE_QTY_MAX)).toBe(true);
    expect(plan.purchaseOrders).toHaveLength(DEMO_COUNTS.purchaseOrders);

    const soQtys = plan.salesOrders.flatMap((row) => row.lines.map((line) => line.qty));
    expect(mean(soQtys)).toBe(SO_LINE_QTY_MEAN);
    expect(soQtys.every((qty) => qty >= SO_LINE_QTY_MIN && qty <= SO_LINE_QTY_MAX)).toBe(true);

    for (const order of plan.purchaseOrders) {
      expect(new Set(order.lines.map((line) => line.sku)).size).toBe(order.lines.length);
      const supplierSkus = new Set(
        plan.master.supplierProducts
          .filter((row) => row.supplierKey === order.supplierKey)
          .map((row) => row.sku),
      );
      for (const line of order.lines) {
        expect(supplierSkus.has(line.sku)).toBe(true);
      }
    }
    for (const order of plan.salesOrders) {
      expect(new Set(order.lines.map((line) => line.sku)).size).toBe(order.lines.length);
    }
  });

  it("covers the five-year calendar curve, Harvest seasonality, Idle Park dormancy, and leftovers", () => {
    expect(plan.historicalStart.getTime()).toBe(demoHistoricalStart(SEED_TODAY).getTime());

    const receivedPo = plan.purchaseOrders.filter((row) => row.status === "received");
    expect(receivedPo.length).toBeGreaterThan(0);
    for (const order of receivedPo) {
      expect(order.plannedInstant.getTime()).toBeLessThanOrEqual(SEED_TODAY.getTime());
      expect(order.plannedInstant.getTime()).toBeGreaterThanOrEqual(plan.historicalStart.getTime());
    }

    const harvestShipped = plan.salesOrders.filter(
      (row) => row.customerKey === "harvest" && row.status === "shipped",
    );
    const harvestQ4 = harvestShipped.filter((row) => isQ4Month(row.plannedInstant)).length;
    expect(harvestQ4 / harvestShipped.length).toBeGreaterThanOrEqual(0.7);

    const receivedPoQ4 = receivedPo.filter((row) => isQ4Month(row.plannedInstant)).length;
    expect(receivedPoQ4 / receivedPo.length).toBeGreaterThan(expectedQ4Fraction() - 0.02);

    const baseShipped = plan.salesOrders.filter((row) => {
      if (row.status !== "shipped") {
        return false;
      }
      return row.customerKey === "acme" || row.customerKey === "northstar" || row.customerKey.startsWith("mix-");
    });
    const baseQ4 = baseShipped.filter((row) => isQ4Month(row.plannedInstant)).length;
    expect(baseQ4 / baseShipped.length).toBeGreaterThan(expectedQ4Fraction() - 0.02);

    const idleShipped = plan.salesOrders.filter(
      (row) => row.customerKey === "idlePark" && row.status === "shipped",
    );
    const recentIdle = idleShipped.filter(
      (row) => utcDayDiff(row.plannedInstant, SEED_TODAY) < 120,
    );
    expect(recentIdle).toHaveLength(1);

    const leftovers = plan.salesOrders.filter((row) => row.status !== "shipped");
    expect(leftovers.length).toBe(3_000);
    expect(
      leftovers.every((row) =>
        isWithinLastDays(row.plannedInstant, SEED_TODAY, FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverWindowDays),
      ),
    ).toBe(true);
    expect(plan.salesOrders.some((row) => row.customerKey === "acme" && row.status === "leftoverDraft")).toBe(true);
    expect(
      plan.salesOrders.some((row) => row.customerKey === "idlePark" && row.status !== "shipped"),
    ).toBe(false);
  });

  it("selects stable payment replay fields", () => {
    expect(plan.shippedInvoices).toHaveLength(12_000);
    expect(selectPaymentReplay(plan.shippedInvoices)).toHaveLength(8_000);
    expect(selectUnpaidReplay(plan.shippedInvoices)).toHaveLength(4_000);

    const idleUnpaid = plan.shippedInvoices.filter((row) => row.customerKey === "idlePark" && !row.paid);
    expect(idleUnpaid).toHaveLength(75);
    for (const persona of ["acme", "northstar", "harvest"] as const) {
      expect(plan.shippedInvoices.some((row) => row.customerKey === persona && !row.paid)).toBe(false);
    }

    const buckets = new Set(
      idleUnpaid.map((row) => demoArBucket(utcDayDiff(row.plannedInstant, SEED_TODAY))),
    );
    expect(buckets.has("current")).toBe(true);
    expect(buckets.has("30_59")).toBe(true);
    expect(buckets.has("60_89")).toBe(true);
    expect(buckets.has("90_plus")).toBe(true);

    const replayA = selectUnpaidReplay(plan.shippedInvoices);
    const replayB = selectUnpaidReplay(planDemoBook({ seedToday: SEED_TODAY }).shippedInvoices);
    expect(replayA).toEqual(replayB);
  }, 30_000);

  it("uses only the explicit seeded random source", () => {
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random is forbidden in demo planner tests");
    });
    try {
      planDemoBook({ seedToday: SEED_TODAY });
      planDemoBook({ seed: "dc-inventory-demo-2", seedToday: SEED_TODAY });
    } finally {
      randomSpy.mockRestore();
    }
  }, 60_000);

  it("keeps persona-specific sales line bands", () => {
    const byCustomer = new Map(plan.master.customers.map((row) => [row.key, row.persona]));
    const northstarLines = plan.salesOrders
      .filter((row) => byCustomer.get(row.customerKey) === "northstar")
      .map((row) => row.lines.length);
    const idleLines = plan.salesOrders
      .filter((row) => byCustomer.get(row.customerKey) === "idlePark")
      .map((row) => row.lines.length);
    const defaultLines = plan.salesOrders
      .filter((row) => {
        const persona = byCustomer.get(row.customerKey);
        return persona === "acme" || persona === "mix" || persona === "harvest";
      })
      .map((row) => row.lines.length);

    expect(northstarLines.every((count) => count >= SO_LINE_COUNT_NORTHSTAR_MIN && count <= SO_LINE_COUNT_NORTHSTAR_MAX)).toBe(true);
    expect(idleLines.every((count) => count >= SO_LINE_COUNT_IDLE_PARK_MIN && count <= SO_LINE_COUNT_IDLE_PARK_MAX)).toBe(true);
    expect(defaultLines.every((count) => count >= SO_LINE_COUNT_DEFAULT_MIN && count <= SO_LINE_COUNT_DEFAULT_MAX)).toBe(true);
    expect(mean(defaultLines)).toBe(SO_LINE_COUNT_DEFAULT_MEAN);
  });

  it("guarantees Phase 1 SKUs appear on received POs and shipped SOs", () => {
    const receivedSkus = new Set(
      plan.purchaseOrders
        .filter((row) => row.status === "received")
        .flatMap((row) => row.lines.map((line) => line.sku)),
    );
    const shippedSkus = new Set(
      plan.salesOrders
        .filter((row) => row.status === "shipped")
        .flatMap((row) => row.lines.map((line) => line.sku)),
    );
    for (const sku of PHASE1_PRODUCT_SKUS) {
      expect(receivedSkus.has(sku)).toBe(true);
      expect(shippedSkus.has(sku)).toBe(true);
    }
  });
});
