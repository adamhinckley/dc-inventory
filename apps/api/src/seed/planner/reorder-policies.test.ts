import { describe, expect, it } from "vitest";
import { planDemoReorderPolicies } from "./reorder-policies.js";

describe("planDemoReorderPolicies", () => {
  it("keeps natural zeros as low stock with min zero and max at least min+12", () => {
    const skus = ["A", "B", "C"];
    const policies = planDemoReorderPolicies({
      seed: "demo",
      skus,
      onHandBySku: new Map([
        ["A", 0],
        ["B", 5],
        ["C", 0],
      ]),
      lowStockMin: 2,
      lowStockMax: 4,
    });

    expect(policies).toHaveLength(3);
    const zeroPolicy = policies.find((row) => row.sku === "A");
    expect(zeroPolicy).toEqual({ sku: "A", minOnHand: 0, maxOnHand: 12 });
  });

  it("raises positive-on-hand mins deterministically when natural zeros are below the band", () => {
    const skus = ["Z", "A", "M", "B"];
    const first = planDemoReorderPolicies({
      seed: "dc-inventory-demo-1",
      skus,
      onHandBySku: new Map([
        ["A", 0],
        ["B", 0],
        ["M", 3],
        ["Z", 7],
      ]),
      lowStockMin: 4,
      lowStockMax: 8,
    });
    const second = planDemoReorderPolicies({
      seed: "dc-inventory-demo-1",
      skus,
      onHandBySku: new Map([
        ["A", 0],
        ["B", 0],
        ["M", 3],
        ["Z", 7],
      ]),
      lowStockMin: 4,
      lowStockMax: 8,
    });

    expect(first).toEqual(second);
    const raised = first.filter((row) => row.minOnHand > 0);
    expect(raised).toHaveLength(2);
    for (const row of first) {
      const onHand = row.sku === "M" ? 3 : row.sku === "Z" ? 7 : 0;
      expect(row.maxOnHand).toBe(Math.max(row.minOnHand + 12, onHand));
    }
    const lowCount = first.filter((row) => {
      const onHand =
        row.sku === "A" || row.sku === "B" ? 0 : row.sku === "M" ? 3 : 7;
      return onHand <= row.minOnHand;
    }).length;
    expect(lowCount).toBeGreaterThanOrEqual(4);
  });

  it("accepts natural zeros above the max without raising mins", () => {
    const skus = ["A", "B", "C", "D", "E"];
    const policies = planDemoReorderPolicies({
      seed: "demo",
      skus,
      onHandBySku: new Map(skus.map((sku) => [sku, 0])),
      lowStockMin: 2,
      lowStockMax: 3,
    });

    expect(policies.every((row) => row.minOnHand === 0)).toBe(true);
    expect(policies.every((row) => row.maxOnHand === 12)).toBe(true);
  });
});
