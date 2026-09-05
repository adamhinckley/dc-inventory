import { describe, expect, it } from "vitest";
import {
  confirmSalesOrderErrorMessage,
  replaceSalesOrderLinesErrorMessage,
  shipSalesOrderErrorMessage,
} from "./sales-order-action-errors";

describe("sales order action errors", () => {
  it("distinguishes confirm insufficient ATP from other conflicts", () => {
    expect(
      confirmSalesOrderErrorMessage({ status: 409, data: { error: "insufficient_atp" } }),
    ).toMatch(/available-to-sell/i);
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
