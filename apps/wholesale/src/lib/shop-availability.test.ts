import { describe, expect, it } from "vitest";
import { shopAvailabilityLabel } from "./shop-availability";

describe("shopAvailabilityLabel", () => {
  it("shows warehouse leftover for open SKUs", () => {
    expect(
      shopAvailabilityLabel({
        sellState: "open",
        available: 12,
        availableToSell: null,
      }),
    ).toEqual({ inStock: true, label: "12 available" });
  });

  it("shows unavailable for open SKUs with no warehouse stock", () => {
    expect(
      shopAvailabilityLabel({
        sellState: "open",
        available: 0,
        availableToSell: null,
      }),
    ).toEqual({ inStock: false, label: "Unavailable" });
  });

  it("shows availableToSell for locked factory-order SKUs", () => {
    expect(
      shopAvailabilityLabel({
        sellState: "locked",
        available: 0,
        availableToSell: 1987987,
      }),
    ).toEqual({ inStock: true, label: "1,987,987 available" });
  });

  it("shows unavailable when locked availableToSell is zero", () => {
    expect(
      shopAvailabilityLabel({
        sellState: "locked",
        available: 0,
        availableToSell: 0,
      }),
    ).toEqual({ inStock: false, label: "Unavailable" });
  });
});
