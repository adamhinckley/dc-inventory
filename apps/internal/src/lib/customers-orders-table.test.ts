import { describe, expect, it } from "vitest";
import { customersOrdersTable } from "./customers-orders-table";

describe("customersOrdersTable", () => {
  it("shows SO # and Status only, without customer chrome", () => {
    expect(customersOrdersTable.columns.map((column) => column.field)).toEqual([
      "documentNumber",
      "status",
    ]);
    expect(customersOrdersTable.filters?.map((filter) => filter.param)).toEqual([
      "status",
    ]);
  });

  it("defaults to documentNumber desc for customer order history", () => {
    expect(customersOrdersTable.sort).toEqual({
      defaultBy: "documentNumber",
      defaultOrder: "desc",
      fields: ["documentNumber", "status"],
    });
  });

  it("searches SO number only", () => {
    expect(customersOrdersTable.search).toEqual({
      param: "q",
      fields: ["documentNumber"],
      placeholder: "Search SO number",
    });
  });
});
