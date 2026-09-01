import { readFileSync } from "node:fs";
import {
  listInternalProductsTable as productsListTable,
  listInternalPurchaseOrdersTable,
} from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import {
  allStaffTableUrlKeys,
  listParamsFromSearchParams,
  tableParamsForUrl,
  tableSearchFromParams,
  tableUrlKeys,
} from "./table-url-params";
import { inventoryListTable } from "./inventory-list-table";

const dateRangeMeta = {
  ...productsListTable,
  filters: [
    { param: "inactive", control: "boolean" as const },
    {
      param: "createdFrom",
      control: "dateRange" as const,
      rangePair: "createdTo",
    },
  ],
};

describe("listParamsFromSearchParams", () => {
  it("reads page, sort, q, and declared filters from the query string", () => {
    expect(
      listParamsFromSearchParams(productsListTable, {
        page: "2",
        q: "bolt",
        sortBy: "name",
        sortOrder: "desc",
        inactive: "true",
        category: "hardware",
        pageSize: "50",
      }),
    ).toEqual({
      page: 2,
      q: "bolt",
      sortBy: "name",
      sortOrder: "desc",
      inactive: true,
    });
  });

  it("parses boolean filters only from true/false tokens", () => {
    const booleanMeta = {
      ...productsListTable,
      filters: [{ param: "active", control: "boolean" as const }],
    };
    expect(
      listParamsFromSearchParams(booleanMeta, { active: "true" }).active,
    ).toBe(true);
    expect(
      listParamsFromSearchParams(booleanMeta, { active: "false" }).active,
    ).toBe(false);
    expect(
      listParamsFromSearchParams(booleanMeta, { active: "1" }),
    ).not.toHaveProperty("active");
    expect(
      listParamsFromSearchParams(booleanMeta, { active: "no" }),
    ).not.toHaveProperty("active");
  });

  it("includes dateRange pair keys declared on x-table", () => {
    expect(
      listParamsFromSearchParams(dateRangeMeta, {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
      }),
    ).toEqual({
      createdFrom: "2026-01-01",
      createdTo: "2026-01-31",
    });
  });
});

describe("tableSearchFromParams", () => {
  it("writes unprefixed keys and drops empty ones without pageSize", () => {
    const next = tableSearchFromParams(
      productsListTable,
      {
        page: 2,
        pageSize: 25,
        sortBy: "name",
        sortOrder: "desc",
        q: "bolt",
        inactive: true,
      },
      "?utm=keep",
    );
    const params = new URLSearchParams(next);
    expect(params.get("page")).toBe("2");
    expect(params.get("q")).toBe("bolt");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("sortOrder")).toBe("desc");
    expect(params.get("inactive")).toBe("true");
    expect(params.get("utm")).toBe("keep");
    expect(params.has("pageSize")).toBe(false);
  });

  it("clears a previous q when search is empty", () => {
    const next = tableSearchFromParams(
      productsListTable,
      tableParamsForUrl(productsListTable, {
        page: 1,
        sortBy: "sku",
        sortOrder: "asc",
      }),
      "?q=bolt&page=2",
    );
    const params = new URLSearchParams(next);
    expect(params.has("q")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.has("sortBy")).toBe(false);
    expect(params.has("sortOrder")).toBe(false);
  });

  it("drops list keys from other staff tables", () => {
    const next = tableSearchFromParams(
      inventoryListTable,
      tableParamsForUrl(
        inventoryListTable,
        { page: 1, sortBy: "sku", sortOrder: "asc", hideZeroInventory: true },
        { booleanFilterDefaults: { hideZeroInventory: true } },
      ),
      "?status=open&supplierId=abc&page=3&q=bolt",
    );
    const params = new URLSearchParams(next);
    expect(params.has("page")).toBe(false);
    expect(params.has("hideZeroInventory")).toBe(false);
    expect(params.has("status")).toBe(false);
    expect(params.has("supplierId")).toBe(false);
    expect(params.has("q")).toBe(false);
  });

  it("keeps hideZeroInventory=false when opting out of the inventory default", () => {
    const next = tableSearchFromParams(
      inventoryListTable,
      tableParamsForUrl(
        inventoryListTable,
        { hideZeroInventory: false },
        { booleanFilterDefaults: { hideZeroInventory: true } },
      ),
      "",
    );
    expect(new URLSearchParams(next).get("hideZeroInventory")).toBe("false");
  });
});

describe("allStaffTableUrlKeys", () => {
  it("includes keys from every generated staff table", () => {
    const keys = allStaffTableUrlKeys();
    for (const key of tableUrlKeys(listInternalPurchaseOrdersTable)) {
      expect(keys).toContain(key);
    }
    expect(keys).toContain("hideZeroInventory");
  });
});

describe("tableUrlKeys", () => {
  it("does not invent prefixed keys or pageSize", () => {
    expect(tableUrlKeys(productsListTable)).toEqual([
      "page",
      "sortBy",
      "sortOrder",
      "q",
      "inactive",
      "hideZeroInventory",
    ]);
  });
});

describe("replaceTableUrlParams source", () => {
  it("uses history.replaceState and never push", () => {
    const source = readFileSync(new URL("./table-url-params.ts", import.meta.url), "utf8");
    expect(source).toContain("history.replaceState");
    expect(source).not.toMatch(/pushState/);
    expect(source).not.toMatch(/history\.push\(/);
    expect(source).not.toMatch(/from\s+["']next\/navigation["']/);
  });
});
