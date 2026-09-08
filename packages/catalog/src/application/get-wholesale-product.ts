import type { CustomerId, OrganizationId, ProductId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import { isShopVisible, type Product } from "../domain/product.js";
import { isWholesaleHiddenBeforeOpen, ZERO_QTY, type ProductQty } from "../domain/qty.js";

export type GetWholesaleProductRequest = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  productId: ProductId;
};

export type GetWholesaleProductResult =
  | { ok: true; product: Product; qty: ProductQty }
  | { ok: false; reason: "not_found" };

export class GetWholesaleProductUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
  ) {}

  async execute(
    input: GetWholesaleProductRequest,
  ): Promise<GetWholesaleProductResult> {
    void input.customerId;
    const product = await this.products.findById(input.organizationId, input.productId);
    if (product === null || !isShopVisible(product)) {
      return { ok: false, reason: "not_found" };
    }
    const snapshots = await this.qty.readBySkus(input.organizationId, [product.sku]);
    const qty = snapshots.get(product.sku.value) ?? ZERO_QTY;
    if (isWholesaleHiddenBeforeOpen(qty, { now: new Date() })) {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: true,
      product,
      qty,
    };
  }
}
