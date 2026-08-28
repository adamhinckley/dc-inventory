import type { ProductId } from "@dc-inventory/shared-kernel";

export type ProductPackaging = {
  readonly productId: ProductId;
  readonly caseQty: number | null;
};

export interface IProductPackagingRepository {
  findByProductId(productId: ProductId): Promise<ProductPackaging | null>;
  save(packaging: ProductPackaging): Promise<void>;
}
