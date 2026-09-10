import type { ProductId } from "@dc-inventory/shared-kernel";

export type ProductPackaging = {
  readonly productId: ProductId;
  readonly packLength: string | null;
  readonly packWidth: string | null;
  readonly packHeight: string | null;
  readonly packWeight: string | null;
  readonly packWeightUom: string | null;
  readonly innerPackQty: number | null;
  readonly innerPackLength: string | null;
  readonly innerPackWidth: string | null;
  readonly innerPackHeight: string | null;
  readonly innerPackWeight: string | null;
  readonly innerPackWeightUom: string | null;
  readonly caseQty: number | null;
  readonly caseLength: string | null;
  readonly caseWidth: string | null;
  readonly caseHeight: string | null;
  readonly caseWeight: string | null;
  readonly caseWeightUom: string | null;
};

export function emptyProductPackaging(productId: ProductId): ProductPackaging {
  return {
    productId,
    packLength: null,
    packWidth: null,
    packHeight: null,
    packWeight: null,
    packWeightUom: null,
    innerPackQty: null,
    innerPackLength: null,
    innerPackWidth: null,
    innerPackHeight: null,
    innerPackWeight: null,
    innerPackWeightUom: null,
    caseQty: null,
    caseLength: null,
    caseWidth: null,
    caseHeight: null,
    caseWeight: null,
    caseWeightUom: null,
  };
}

export interface IProductPackagingRepository {
  findByProductId(productId: ProductId): Promise<ProductPackaging | null>;
  findByProductIds(
    productIds: readonly ProductId[],
  ): Promise<ReadonlyMap<string, ProductPackaging>>;
  save(packaging: ProductPackaging): Promise<void>;
  saveMany(packaging: readonly ProductPackaging[]): Promise<void>;
}
