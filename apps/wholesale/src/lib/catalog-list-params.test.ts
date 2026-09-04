import { describe, expect, it } from "vitest";
import {
  buildCatalogListSearchParams,
  catalogListPageCount,
  parseCatalogListParams,
  wholesaleCatalogRequestParams,
} from "./catalog-list-params";

describe("catalog-list-params", () => {
  it("defaults to available-only page one", () => {
    expect(parseCatalogListParams(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
      availableOnly: true,
    });
    expect(buildCatalogListSearchParams(parseCatalogListParams(new URLSearchParams()))).toBe(
      "",
    );
  });

  it("round-trips pagination and the available-only opt-out", () => {
    const params = parseCatalogListParams(
      new URLSearchParams("page=3&availableOnly=false"),
    );
    expect(params).toMatchObject({ page: 3, availableOnly: false });
    expect(buildCatalogListSearchParams(params)).toBe("page=3&availableOnly=false");
  });

  it("always sends availableOnly to the catalog API", () => {
    expect(wholesaleCatalogRequestParams(parseCatalogListParams(new URLSearchParams()))).toEqual({
      page: 1,
      pageSize: 25,
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
    expect(catalogListPageCount(0, 25)).toBe(1);
    expect(catalogListPageCount(25, 25)).toBe(1);
    expect(catalogListPageCount(26, 25)).toBe(2);
  });
});
