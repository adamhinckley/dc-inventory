import type { Money } from "@dc-inventory/shared-kernel";

/** Nullable catalog attributes with stable defaults for create paths and tests. */
export type ProductCatalogAttributes = {
  countryOfOrigin: string | null;
  material: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  diameter: string | null;
  size: string | null;
  weight: string | null;
  weightUom: string | null;
  originalWholesalePrice: Money | null;
  catalogPage: string | null;
  defaultOrderQty: number | null;
  defaultWeight: string | null;
  defaultWeightUom: string | null;
  nonStock: boolean;
  noExport: boolean;
  webRetail: boolean;
};

export function emptyProductCatalogAttributes(): ProductCatalogAttributes {
  return {
    countryOfOrigin: null,
    material: null,
    length: null,
    width: null,
    height: null,
    diameter: null,
    size: null,
    weight: null,
    weightUom: null,
    originalWholesalePrice: null,
    catalogPage: null,
    defaultOrderQty: null,
    defaultWeight: null,
    defaultWeightUom: null,
    nonStock: false,
    noExport: false,
    webRetail: false,
  };
}
