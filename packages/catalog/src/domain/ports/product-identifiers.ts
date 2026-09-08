import type { ProductId } from "@dc-inventory/shared-kernel";

export type ProductIdentifierKind = "upc" | "mfg" | "alt";

export type ProductIdentifier = {
  readonly productId: ProductId;
  readonly kind: ProductIdentifierKind;
  readonly code: string;
};

export type ProductIdentifierAssignment = {
  readonly productId: ProductId;
  readonly identifiers: readonly ProductIdentifier[];
};

export interface IProductIdentifierRepository {
  findByProductId(productId: ProductId): Promise<readonly ProductIdentifier[]>;
  replaceForProducts(assignments: readonly ProductIdentifierAssignment[]): Promise<void>;
}

export function productIdentifiersFromCodes(
  productId: ProductId,
  upc: string | null,
  mfgCode: string | null,
  altCodes: readonly string[] = [],
): ProductIdentifier[] {
  const identifiers: ProductIdentifier[] = [];
  if (upc !== null) {
    identifiers.push({ productId, kind: "upc", code: upc });
  }
  if (mfgCode !== null) {
    identifiers.push({ productId, kind: "mfg", code: mfgCode });
  }
  for (const code of altCodes) {
    const trimmed = code.trim();
    if (trimmed.length > 0) {
      identifiers.push({ productId, kind: "alt", code: trimmed });
    }
  }
  return identifiers;
}
