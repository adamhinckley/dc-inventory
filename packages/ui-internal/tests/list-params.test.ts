import { describe, expect, it } from "vitest";
import {
  defaultTableState,
  listParamsFromState,
  nextTableSort,
  tableStateFromInitial,
  type DataTableState,
} from "../src/data-table/list-params";
import type { TableMeta } from "../src/data-table/table-meta";
import { productsListTableFixture as productsListTable } from "./table-meta.fixture";

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

  it("sends every selected value for a declared multiselect filter", () => {
    const meta: TableMeta = {
      ...productsListTable,
      filters: [{ param: "category", control: "multiselect" }],
    };
    const state: DataTableState = {
      ...defaultTableState(meta),
      filters: { category: ["Hardware", "Textiles"] },
    };
    expect(listParamsFromState(meta, state).category).toEqual([
      "Hardware",
      "Textiles",
    ]);
  });

  it("includes declared filter params from x-table", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      filters: { inactive: true },
    };
    expect(listParamsFromState(productsListTable, state).inactive).toBe(true);
  });

  it("drops invented filters that are not in x-table", () => {
    const state: DataTableState = {
      ...defaultTableState(productsListTable),
      filters: { inactive: true, category: "hardware" },
    };
    const params = listParamsFromState(productsListTable, state);
    expect(params.inactive).toBe(true);
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

  it("does not send sort parameters when x-table does not declare sorting", () => {
    const { sort: _sort, ...unsortedMeta } = productsListTable;
    const state = defaultTableState(unsortedMeta);

    expect(listParamsFromState(unsortedMeta, state)).toEqual({
      page: 1,
      pageSize: 25,
    });
  });
});

describe("tableStateFromInitial", () => {
  it("uses URL page, q, sort, and declared filters on first paint", () => {
    const state = tableStateFromInitial(productsListTable, {
      page: 2,
      q: "bolt",
      sortBy: "name",
      sortOrder: "desc",
      inactive: true,
      category: "hardware",
    });
    expect(state.page).toBe(2);
    expect(state.search).toBe("bolt");
    expect(state.sortBy).toBe("name");
    expect(state.sortOrder).toBe("desc");
    expect(state.filters.inactive).toBe(true);
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

describe("nextTableSort", () => {
  it("toggles asc/desc on the active sortable column and ignores others", () => {
    expect(
      nextTableSort(productsListTable, { sortBy: "sku", sortOrder: "asc" }, "name"),
    ).toEqual({ sortBy: "name", sortOrder: "asc" });
    expect(
      nextTableSort(productsListTable, { sortBy: "name", sortOrder: "asc" }, "name"),
    ).toEqual({ sortBy: "name", sortOrder: "desc" });
    expect(
      nextTableSort(productsListTable, { sortBy: "name", sortOrder: "desc" }, "name"),
    ).toEqual({ sortBy: "name", sortOrder: "asc" });
    expect(
      nextTableSort(
        productsListTable,
        { sortBy: "sku", sortOrder: "asc" },
        "listPrice",
      ),
    ).toEqual({ sortBy: "sku", sortOrder: "asc" });
  });
});
