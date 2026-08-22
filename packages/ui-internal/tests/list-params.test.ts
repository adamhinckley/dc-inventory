import { describe, expect, it } from "vitest";
import { productsListTable } from "../src/data-table/fixtures/products-list-table";
import {
  defaultTableState,
  listParamsFromState,
  tableStateFromParams,
  type DataTableState,
} from "../src/data-table/list-params";
import type { TableMeta } from "../src/data-table/table-meta";

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
} satisfies TableMeta;

describe("listParamsFromState", () => {
  it("starts from x-table sort defaults and page 1 / pageSize 25", () => {
    const state = defaultTableState(productsListTable);
    expect(listParamsFromState(productsListTable, state)).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: "sku",
      sortOrder: "asc",
    });
  });

  it("sends search on the meta search param only", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      search: "bolt",
    };
    expect(listParamsFromState(productsListTable, state).q).toBe("bolt");
  });

  it("includes declared filter params from x-table", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      filters: { status: "active" },
    };
    expect(listParamsFromState(productsListTable, state).status).toBe("active");
  });

  it("drops invented filters that are not in x-table", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      filters: { status: "active", category: "hardware" },
    };
    const params = listParamsFromState(productsListTable, state);
    expect(params.status).toBe("active");
    expect(params).not.toHaveProperty("category");
  });

  it("includes dateRange pair params declared on x-table", () => {
    const state: DataTableState = {
      ...defaultTableState(dateRangeMeta),
      filters: {
        createdFrom: "2026-01-01",
        createdTo: "2026-01-31",
        category: "hardware",
      },
    };
    const params = listParamsFromState(dateRangeMeta, state);
    expect(params.createdFrom).toBe("2026-01-01");
    expect(params.createdTo).toBe("2026-01-31");
    expect(params).not.toHaveProperty("category");
  });
});

describe("tableStateFromParams", () => {
  it("hydrates page, search, sort, and declared filters for first paint", () => {
    const state = tableStateFromParams(productsListTable, {
      page: 2,
      q: "bolt",
      sortBy: "name",
      sortOrder: "desc",
      status: "active",
      category: "hardware",
    });
    expect(state.page).toBe(2);
    expect(state.search).toBe("bolt");
    expect(state.sortBy).toBe("name");
    expect(state.sortOrder).toBe("desc");
    expect(state.filters).toEqual({ status: "active" });
    expect(state.pageSize).toBe(25);
  });

  it("falls back to x-table defaults when initialParams is omitted", () => {
    expect(tableStateFromParams(productsListTable)).toEqual(
      defaultTableState(productsListTable),
    );
  });
});
