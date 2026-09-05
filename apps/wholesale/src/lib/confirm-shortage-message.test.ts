import { describe, expect, it } from "vitest";
import {
  formatConfirmShortageMessage,
  GENERIC_CONFIRM_ORDER_ERROR,
  wholesaleConfirmErrorMessage,
} from "./confirm-shortage-message";

describe("formatConfirmShortageMessage", () => {
  it("names the product and the purchasable quantity", () => {
    expect(
      formatConfirmShortageMessage({
        name: "10”H Glass Vase - Pink (1/4)",
        sku: "VASE-PINK",
        requestedQty: 1500,
        availableQty: 2,
      }),
    ).toBe("10”H Glass Vase - Pink (1/4) has 2 available. You asked for 1500.");
  });

  it("says sold out when nothing is purchasable", () => {
    expect(
      formatConfirmShortageMessage({
        name: "Locked presell widget",
        requestedQty: 12,
        availableQty: 0,
      }),
    ).toBe("Locked presell widget is sold out. You asked for 12.");
  });
});

describe("wholesaleConfirmErrorMessage", () => {
  it("reads shortage fields from a wholesale HTTP error", () => {
    const error = Object.assign(new Error("HTTP 409 Conflict"), {
      data: {
        error: "insufficient_atp",
        name: "Locked presell widget",
        requestedQty: 401,
        availableQty: 400,
      },
    });
    expect(wholesaleConfirmErrorMessage(error)).toBe(
      "Locked presell widget has 400 available. You asked for 401.",
    );
  });

  it("falls back when the body has no shortage details", () => {
    expect(wholesaleConfirmErrorMessage(new Error("HTTP 409 Conflict"))).toBe(
      GENERIC_CONFIRM_ORDER_ERROR,
    );
  });
});
