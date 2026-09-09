import { describe, expect, it } from "vitest";
import {
  buildCatalogListSearchParams,
  catalogListPageCount,
  catalogSortKey,
  changeCatalogListParams,
  paginationItems,
  parseCatalogListParams,
  wholesaleCatalogRequestParams,
} from "./catalog-list-params";

describe("catalog-list-params", () => {
  it("defaults to available-only page one, 48 per page, name A–Z", () => {
    expect(parseCatalogListParams(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 48,
      sortBy: "name",
      sortOrder: "asc",
      availableOnly: true,
    });
    expect(buildCatalogListSearchParams(parseCatalogListParams(new URLSearchParams()))).toBe(
      "",
    );
  });

  it("round-trips pagination and the available-only opt-out", () => {
    const params = parseCatalogListParams(new URLSearchParams("page=3&availableOnly=false"));
    expect(params).toMatchObject({ page: 3, availableOnly: false });
    expect(buildCatalogListSearchParams(params)).toBe("page=3&availableOnly=false");
  });

  it("round-trips search, category, sort, and page size", () => {
    const params = parseCatalogListParams(
      new URLSearchParams("q=+vase+&category=Ribbon&sort=available-desc&pageSize=96&page=2"),
    );
    expect(params).toEqual({
      q: "vase",
      category: "Ribbon",
      page: 2,
      pageSize: 96,
      sortBy: "available",
      sortOrder: "desc",
      availableOnly: true,
    });
    expect(buildCatalogListSearchParams(params)).toBe(
      "q=vase&category=Ribbon&sort=available-desc&pageSize=96&page=2",
    );
  });

  it("ignores unknown sort keys and page sizes", () => {
    const params = parseCatalogListParams(new URLSearchParams("sort=price-asc&pageSize=7"));
    expect(params).toMatchObject({ sortBy: "name", sortOrder: "asc", pageSize: 48 });
    expect(catalogSortKey({ sortBy: "name", sortOrder: "desc" })).toBe("name-desc");
  });

  it("resets to page 1 when a filter changes but not when only the page changes", () => {
    const onPageThree = parseCatalogListParams(new URLSearchParams("page=3&category=Ribbon"));
    expect(changeCatalogListParams(onPageThree, { q: "vase" }).page).toBe(1);
    expect(changeCatalogListParams(onPageThree, { pageSize: 96 }).page).toBe(1);
    expect(changeCatalogListParams(onPageThree, { category: "Halloween" }).page).toBe(1);
    expect(changeCatalogListParams(onPageThree, { availableOnly: false }).page).toBe(1);
    expect(changeCatalogListParams(onPageThree, { page: 4 })).toMatchObject({
      page: 4,
      category: "Ribbon",
    });
    expect(changeCatalogListParams(onPageThree, { category: "Ribbon" }).page).toBe(3);
  });

  it("drops a cleared search or category instead of sending an empty string", () => {
    const withSearch = parseCatalogListParams(new URLSearchParams("q=vase&category=Ribbon"));
    const cleared = changeCatalogListParams(withSearch, { q: "", category: "  " });
    expect(cleared).not.toHaveProperty("q");
    expect(cleared).not.toHaveProperty("category");
    expect(buildCatalogListSearchParams(cleared)).toBe("");
  });

  it("always sends availableOnly to the catalog API", () => {
    expect(wholesaleCatalogRequestParams(parseCatalogListParams(new URLSearchParams()))).toEqual({
      page: 1,
      pageSize: 48,
      sortBy: "name",
      sortOrder: "asc",
      availableOnly: true,
    });
    expect(
      wholesaleCatalogRequestParams(
        parseCatalogListParams(new URLSearchParams("availableOnly=false")),
      ).availableOnly,
    ).toBe(false);
  });

  it("computes page count from total and page size", () => {
    expect(catalogListPageCount(0, 48)).toBe(1);
    expect(catalogListPageCount(48, 48)).toBe(1);
    expect(catalogListPageCount(49, 48)).toBe(2);
  });

  it("lists every page when there are few, and elides the middle when there are many", () => {
    expect(paginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationItems(1, 12)).toEqual([1, 2, 3, 4, null, 12]);
    expect(paginationItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(paginationItems(12, 12)).toEqual([1, null, 9, 10, 11, 12]);
  });
});
