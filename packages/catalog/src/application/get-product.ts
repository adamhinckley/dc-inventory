import { Sku, type OrganizationId, type ProductId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductPackagingRepository } from "../domain/ports/product-packaging.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";

export type GetProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  productId?: ProductId;
  sku?: string;
};

export type GetProductResult =
  | { ok: true; product: Product; qty: ProductQty; caseQty: number | null }
  | { ok: false; reason: "not_found" };

export class GetProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
    private readonly packaging: IProductPackagingRepository,
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
    const pack = await this.packaging.findByProductId(product.id);
    return {
      ok: true,
      product,
      qty: snapshots.get(product.sku.value) ?? ZERO_QTY,
      caseQty: pack?.caseQty ?? null,
    };
  }
}
