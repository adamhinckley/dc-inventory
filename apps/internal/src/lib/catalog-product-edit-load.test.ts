import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";
import {
  CATALOG_PRODUCT_EDIT_LOAD_ERROR,
  CATALOG_PRODUCT_EDIT_LOAD_PENDING,
  catalogProductEditLoadCopy,
} from "./catalog-product-edit-load";

const serverError = {
  status: 500,
  data: { error: "internal_error", message: "An unexpected error occurred." },
  headers: new Headers(),
};

describe("catalogProductEditLoadCopy", () => {
  it("shows the error copy for a 500 Orval envelope even when isError is false", () => {
    expect(isSuccessfulOrvalResponse(serverError)).toBe(false);
    expect(
      catalogProductEditLoadCopy({ data: serverError, isError: false }),
    ).toBe(CATALOG_PRODUCT_EDIT_LOAD_ERROR);
    expect(catalogProductEditLoadCopy({ data: serverError, isError: false })).not.toBe(
      CATALOG_PRODUCT_EDIT_LOAD_PENDING,
    );
  });

  it("keeps loading only while no envelope has arrived", () => {
    expect(catalogProductEditLoadCopy({ data: undefined, isError: false })).toBe(
      CATALOG_PRODUCT_EDIT_LOAD_PENDING,
    );
  });

  it("shows the error copy when React Query sets isError", () => {
    expect(catalogProductEditLoadCopy({ data: undefined, isError: true })).toBe(
      CATALOG_PRODUCT_EDIT_LOAD_ERROR,
    );
  });

  it("does not treat a 200 envelope as a failed load", () => {
    expect(
      catalogProductEditLoadCopy({
        data: { status: 200, data: { id: "prod-1" } },
        isError: false,
      }),
    ).toBe(CATALOG_PRODUCT_EDIT_LOAD_PENDING);
  });
});

describe("CatalogProductEditDialog wiring", () => {
  it("uses the load-copy helper instead of keying only on query.isError", () => {
    const source = readFileSync(
      new URL("../components/catalog-product-edit-dialog.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("catalogProductEditLoadCopy");
    expect(source).not.toContain(
      'query.isError ? "Could not load this product." : "Loading product…"',
    );
  });
});
