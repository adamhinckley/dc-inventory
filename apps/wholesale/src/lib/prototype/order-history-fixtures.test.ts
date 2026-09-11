import { describe, expect, it } from "vitest";
import {
  assertPrototypeOrdersAreHistoryOnly,
  findPrototypeOrder,
  isPrototypeOrderVariant,
  PROTOTYPE_ORDERS,
  prototypeOrderPath,
} from "./order-history-fixtures";

describe("order history prototypes", () => {
  it("uses only visible history statuses and unique SO numbers", () => {
    expect(assertPrototypeOrdersAreHistoryOnly(PROTOTYPE_ORDERS)).toBe(true);
    const numbers = PROTOTYPE_ORDERS.map((order) => order.documentNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(findPrototypeOrder("SO-00042")?.status).toBe("confirmed");
    expect(findPrototypeOrder("SO-00001")).toBeUndefined();
  });

  it("builds prototype paths and accepts a b c only", () => {
    expect(prototypeOrderPath("a", "SO-00042")).toBe("/order-history-prototype/a/SO-00042");
    expect(isPrototypeOrderVariant("b")).toBe(true);
    expect(isPrototypeOrderVariant("d")).toBe(false);
  });
});
