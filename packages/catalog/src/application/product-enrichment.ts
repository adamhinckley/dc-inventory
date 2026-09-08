import type { OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import type { IProductCategoryRepository } from "../domain/ports/product-categories.js";
import type { IProductIdentifierRepository } from "../domain/ports/product-identifiers.js";
import type { IProductPackagingRepository, ProductPackaging } from "../domain/ports/product-packaging.js";
import type {
  IProductPrimarySupplierReadPort,
  ProductPrimarySupplierTerms,
} from "../domain/ports/product-primary-supplier-read.js";
import type { IProductReorderReadPort } from "../domain/ports/product-reorder-read.js";

export type ProductEnrichment = {
  packaging: ProductPackaging | null;
  categoryNames: readonly string[];
  upc: string | null;
  mfgCode: string | null;
  altCodes: readonly string[];
  primarySupplier: ProductPrimarySupplierTerms | null;
  reorderMin: number | null;
  reorderMax: number | null;
};

export async function loadProductEnrichment(
  organizationId: OrganizationId,
  productId: ProductId,
  sku: Sku,
  packaging: IProductPackagingRepository,
  categories: IProductCategoryRepository,
  identifiers: IProductIdentifierRepository,
  primarySupplier: IProductPrimarySupplierReadPort,
  reorder: IProductReorderReadPort,
): Promise<ProductEnrichment> {
  const [pack, categoryNames, identifierRows, supplier, reorderPolicy] = await Promise.all([
    packaging.findByProductId(productId),
    categories.listNamesForProduct(organizationId, productId),
    identifiers.findByProductId(productId),
    primarySupplier.findByCatalogSku(organizationId, sku),
    reorder.findByCatalogSku(organizationId, sku),
  ]);
  let mfgCode = identifierRows.find((row) => row.kind === "mfg")?.code ?? null;
  if (mfgCode === null && supplier?.supplierSku !== null && supplier?.supplierSku !== undefined) {
    mfgCode = supplier.supplierSku;
  }
  return {
    packaging: pack,
    categoryNames,
    upc: identifierRows.find((row) => row.kind === "upc")?.code ?? null,
    mfgCode,
    altCodes: identifierRows.filter((row) => row.kind === "alt").map((row) => row.code),
    primarySupplier: supplier,
    reorderMin: reorderPolicy?.reorderMin ?? null,
    reorderMax: reorderPolicy?.reorderMax ?? null,
  };
}
