import { describe, expect, it } from "vitest";
import { initialCheckoutShipToId } from "./checkout-ship-to";

describe("initialCheckoutShipToId", () => {
  it("selects the only address", () => {
    expect(initialCheckoutShipToId([{ id: "solo" }])).toBe("solo");
  });

  it("selects the default when there are several", () => {
    expect(
      initialCheckoutShipToId([
        { id: "a" },
        { id: "preferred", isDefault: true },
        { id: "c" },
      ]),
    ).toBe("preferred");
  });

  it("falls back to the first address when none is marked default", () => {
    expect(initialCheckoutShipToId([{ id: "a" }, { id: "b" }])).toBe("a");
  });

  it("returns null when there are no addresses", () => {
    expect(initialCheckoutShipToId([])).toBeNull();
  });
});
