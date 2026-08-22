import { describe, expect, it } from "vitest";
import { productsListTable } from "../src/fixtures/products-list-table";
import {
  defaultTableState,
  listParamsFromState,
  tableStateFromInitial,
  toggleColumnSort,
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

describe("tableStateFromInitial", () => {
  it("uses URL page, q, sort, and declared filters on first paint", () => {
    const state = tableStateFromInitial(productsListTable, {
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
    expect(state.filters.status).toBe("active");
    expect(state.filters).not.toHaveProperty("category");
  });

  it("falls back to x-table defaults when initialParams are empty", () => {
    expect(tableStateFromInitial(productsListTable)).toEqual(
      defaultTableState(productsListTable),
    );
  });

  it("parses boolean filters only from true/false tokens", () => {
    const booleanMeta = {
      ...productsListTable,
      filters: [{ param: "active", control: "boolean" as const }],
    } satisfies TableMeta;

    expect(
      tableStateFromInitial(booleanMeta, { active: "true" }).filters.active,
    ).toBe(true);
    expect(
      tableStateFromInitial(booleanMeta, { active: "false" }).filters.active,
    ).toBe(false);
    expect(
      tableStateFromInitial(booleanMeta, { active: "no" }).filters,
    ).not.toHaveProperty("active");
    expect(
      tableStateFromInitial(booleanMeta, { active: 1 }).filters,
    ).not.toHaveProperty("active");
  });

  it("ignores invalid page and unknown sortBy", () => {
    const state = tableStateFromInitial(productsListTable, {
      page: 0,
      sortBy: "price",
    });
    expect(state.page).toBe(1);
    expect(state.sortBy).toBe("sku");
  });
});

describe("toggleColumnSort", () => {
  const fields = productsListTable.sort.fields;

  it("starts a new column at ascending and returns to page 1", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      page: 3,
      sortBy: "sku",
      sortOrder: "desc",
    };
    expect(toggleColumnSort(state, "name", fields)).toMatchObject({
      page: 1,
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  it("toggles the active column from asc to desc", () => {
    const state = defaultTableState(productsListTable);
    expect(toggleColumnSort(state, "sku", fields).sortOrder).toBe("desc");
  });

  it("leaves undeclared columns unchanged", () => {
    const state = defaultTableState(productsListTable);
    expect(toggleColumnSort(state, "onHand", fields)).toBe(state);
  });
});
