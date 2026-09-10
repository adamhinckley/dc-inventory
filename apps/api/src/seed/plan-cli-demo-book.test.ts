import { describe, expect, it } from "vitest";
import { planCliDemoBook } from "./plan-cli-demo-book.js";
const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");

describe("planCliDemoBook", () => {
  it("plans a reduced bench for the default CLI profile", () => {
    const { plan, expectations } = planCliDemoBook({
      profile: "reduced",
      seed: "dc-inventory-demo-1",
      seedToday: SEED_TODAY,
    });

    expect(plan.shippedInvoices.length).toBeGreaterThan(0);
    expect(expectations.invoiceCount).toBeGreaterThan(0);
    expect(plan.master.customers.some((row) => row.key === "idlePark")).toBe(true);
  });
});
