import type { OrganizationId, ProductId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";

export type GetProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  productId: ProductId;
};

export type GetProductResult =
  | { ok: true; product: Product; qty: ProductQty }
  | { ok: false; reason: "not_found" };

export class GetProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
  ) {}

  async execute(input: GetProductRequest): Promise<GetProductResult> {
    void input.staffUserId;
    const product = await this.products.findById(input.organizationId, input.productId);
    if (product === null) {
      return { ok: false, reason: "not_found" };
    }
    const snapshots = await this.qty.readBySkus(input.organizationId, [product.sku]);
    return {
      ok: true,
      product,
      qty: snapshots.get(product.sku.value) ?? ZERO_QTY,
    };
  }
}
