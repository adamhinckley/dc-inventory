import { Sku, type OrganizationId, type ProductId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductCategoryRepository } from "../domain/ports/product-categories.js";
import type { IProductIdentifierRepository } from "../domain/ports/product-identifiers.js";
import type { IProductPrimarySupplierReadPort } from "../domain/ports/product-primary-supplier-read.js";
import type { IProductReorderReadPort } from "../domain/ports/product-reorder-read.js";
import type { IProductPackagingRepository } from "../domain/ports/product-packaging.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";
import { loadProductEnrichment, type ProductEnrichment } from "./product-enrichment.js";

export type GetProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  productId?: ProductId;
  sku?: string;
};

export type GetProductResult =
  | { ok: true; product: Product; qty: ProductQty } & ProductEnrichment
  | { ok: false; reason: "not_found" };

export class GetProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
    private readonly packaging: IProductPackagingRepository,
    private readonly categories: IProductCategoryRepository,
    private readonly identifiers: IProductIdentifierRepository,
    private readonly primarySupplier: IProductPrimarySupplierReadPort,
    private readonly reorder: IProductReorderReadPort,
  ) {}

  async execute(input: GetProductRequest): Promise<GetProductResult> {
    void input.staffUserId;
    const product =
      input.productId !== undefined
        ? await this.products.findById(input.organizationId, input.productId)
        : input.sku !== undefined
          ? await this.products.findBySku(input.organizationId, Sku.parse(input.sku))
          : null;
    if (product === null) {
      return { ok: false, reason: "not_found" };
    }
    const snapshots = await this.qty.readBySkus(input.organizationId, [product.sku]);
    const enrichment = await loadProductEnrichment(
      input.organizationId,
      product.id,
      product.sku,
      this.packaging,
      this.categories,
      this.identifiers,
      this.primarySupplier,
      this.reorder,
    );
    return {
      ok: true,
      product,
      qty: snapshots.get(product.sku.value) ?? ZERO_QTY,
      ...enrichment,
    };
  }
}
