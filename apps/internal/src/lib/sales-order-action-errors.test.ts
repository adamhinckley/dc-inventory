import { describe, expect, it } from "vitest";
import {
  confirmSalesOrderErrorMessage,
  replaceSalesOrderLinesErrorMessage,
  shipSalesOrderErrorMessage,
} from "./sales-order-action-errors";
import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";

describe("sales order action errors", () => {
  it("distinguishes confirm insufficient ATP from other conflicts", () => {
    const insufficientAtp = { status: 409, data: { error: "insufficient_atp" } };
    expect(isSuccessfulOrvalResponse(insufficientAtp)).toBe(false);
    expect(confirmSalesOrderErrorMessage(insufficientAtp)).toMatch(/available-to-sell/i);
    expect(
      confirmSalesOrderErrorMessage({
        status: 409,
        data: {
          error: "insufficient_atp",
          name: "Locked presell widget",
          requestedQty: 401,
          availableQty: 400,
        },
      }),
    ).toBe("Locked presell widget has 400 available. You asked for 401.");
    expect(
      confirmSalesOrderErrorMessage({ status: 409, data: { error: "conflict" } }),
    ).toMatch(/conflict/i);
  });

  it("maps replace and ship failures to distinct copy", () => {
    expect(replaceSalesOrderLinesErrorMessage({ status: 400 })).toMatch(/invalid/i);
    expect(shipSalesOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toMatch(
      /conflict/i,
    );
  });
});
