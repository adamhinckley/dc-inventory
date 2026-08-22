import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productsListTable } from "./products-list-table";
import {
  listParamsFromSearchParams,
  tableSearchFromParams,
  tableUrlKeys,
} from "./table-url-params";

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

describe("listParamsFromSearchParams", () => {
  it("reads page, sort, q, and declared filters from the query string", () => {
    expect(
      listParamsFromSearchParams(productsListTable, {
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
        status: "active",
      },
      "?utm=keep",
    );
    const params = new URLSearchParams(next);
    expect(params.get("page")).toBe("2");
    expect(params.get("q")).toBe("bolt");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("sortOrder")).toBe("desc");
    expect(params.get("status")).toBe("active");
    expect(params.get("utm")).toBe("keep");
    expect(params.has("pageSize")).toBe(false);
  });

  it("clears a previous q when search is empty", () => {
    const next = tableSearchFromParams(
      productsListTable,
      { page: 1, sortBy: "sku", sortOrder: "asc" },
      "?q=bolt&page=2",
    );
    const params = new URLSearchParams(next);
    expect(params.has("q")).toBe(false);
    expect(params.get("page")).toBe("1");
  });
});

describe("tableUrlKeys", () => {
  it("does not invent prefixed keys or pageSize", () => {
    expect(tableUrlKeys(productsListTable)).toEqual([
      "page",
      "sortBy",
      "sortOrder",
      "q",
      "status",
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
