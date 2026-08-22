import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  tableParamsFromSearchParams,
  tableUrlKeys,
  tableUrlSearchParams,
} from "./table-url-params";
import { productsListTable } from "./products-list-table";

const dateRangeMeta = {
  ...productsListTable,
  filters: [
    { param: "status", control: "select" as const },
    {
      param: "createdFrom",
      control: "dateRange" as const,
      rangePair: "createdTo",
    },
  ],
};

describe("tableParamsFromSearchParams", () => {
  it("maps page, sort, q, and declared filters from the query string", () => {
    expect(
      tableParamsFromSearchParams(productsListTable, {
        page: "2",
        q: "bolt",
        sortBy: "name",
        sortOrder: "desc",
        status: "active",
        category: "hardware",
        pageSize: "50",
      }),
    ).toEqual({
      page: 2,
      q: "bolt",
      sortBy: "name",
      sortOrder: "desc",
      status: "active",
    });
  });

  it("includes dateRange pair keys declared on x-table", () => {
    expect(
      tableParamsFromSearchParams(dateRangeMeta, {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
      }),
    ).toEqual({
      createdFrom: "2026-01-01",
      createdTo: "2026-01-31",
    });
  });
});

describe("tableUrlSearchParams", () => {
  it("writes share keys and omits defaults and pageSize", () => {
    const search = tableUrlSearchParams(productsListTable, {
      page: 2,
      pageSize: 25,
      q: "bolt",
      sortBy: "sku",
      sortOrder: "asc",
      status: "active",
    });
    expect(search.get("page")).toBe("2");
    expect(search.get("q")).toBe("bolt");
    expect(search.get("status")).toBe("active");
    expect(search.get("sortBy")).toBeNull();
    expect(search.get("sortOrder")).toBeNull();
    expect(search.get("pageSize")).toBeNull();
  });

  it("does not include pageSize in the table URL key set", () => {
    expect(tableUrlKeys(productsListTable)).toEqual([
      "page",
      "sortBy",
      "sortOrder",
      "q",
      "status",
    ]);
    expect(tableUrlKeys(productsListTable)).not.toContain("pageSize");
  });
});

describe("replaceTableUrl", () => {
  it("uses history.replaceState and never push", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "table-url-params.ts"),
      "utf8",
    );
    expect(source).toContain("history.replaceState");
    expect(source).not.toContain("pushState");
    expect(source).not.toContain("history.push");
    expect(source).not.toContain("useSearchParams");
    expect(source).not.toContain("next/navigation");
  });
});
