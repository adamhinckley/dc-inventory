import { describe, expect, it } from "vitest";
import {
  confirmSalesOrderErrorMessage,
  isCreditExceededConfirmError,
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

  it("flags credit exceeded confirm failures for override handling", () => {
    const creditExceeded = {
      status: 409,
      data: {
        error: "credit_exceeded",
        availableCreditCents: 2500,
        orderTotalCents: 5000,
      },
    };
    expect(isCreditExceededConfirmError(creditExceeded)).toBe(true);
    expect(confirmSalesOrderErrorMessage(creditExceeded)).toBe(
      "Available credit is $25.00; this order totals $50.00.",
    );
  });

  it("maps replace and ship failures to distinct copy", () => {
    expect(replaceSalesOrderLinesErrorMessage({ status: 400 })).toMatch(/invalid/i);
    expect(shipSalesOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toMatch(
      /conflict/i,
    );
    expect(
      shipSalesOrderErrorMessage({
        status: 409,
        data: {
          error: "insufficient_cover",
          name: "Cover presell widget",
          requestedQty: 1_200,
          coveredQty: 500,
        },
      }),
    ).toBe("Cover presell widget has 500 allocated. You asked to ship 1200.");
    expect(
      shipSalesOrderErrorMessage({ status: 409, data: { error: "bill_to_missing" } }),
    ).toBe("Shipping refused because this customer has no bill-to address.");
    expect(
      shipSalesOrderErrorMessage({ status: 409, data: { error: "accounting_invalid" } }),
    ).toBe("Could not post an invoice. Check that the customer has payment terms.");
    expect(
      shipSalesOrderErrorMessage({ status: 409, data: { error: "illegal_transition" } }),
    ).toBe("This order is not confirmed, so it cannot be shipped.");
  });
});
