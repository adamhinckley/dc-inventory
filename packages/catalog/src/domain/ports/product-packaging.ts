import type { ProductId } from "@dc-inventory/shared-kernel";

export type ProductPackaging = {
  readonly productId: ProductId;
  readonly caseQty: number | null;
  readonly caseLength: string | null;
  readonly caseWidth: string | null;
  readonly caseHeight: string | null;
};

export interface IProductPackagingRepository {
  findByProductId(productId: ProductId): Promise<ProductPackaging | null>;
  save(packaging: ProductPackaging): Promise<void>;
}
