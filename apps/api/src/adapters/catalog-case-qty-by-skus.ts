import type {
  IProductPackagingRepository,
  IProductRepository,
} from "@dc-inventory/catalog";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type CaseQtyBySkuRow = Readonly<{ caseQty: number | null }>;

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export async function readCaseQtyBySkus(
  organizationId: OrganizationId,
  skus: readonly Sku[],
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): Promise<ReadonlyMap<string, CaseQtyBySkuRow>> {
  const values = uniqueSkus(skus);
  const rows = new Map<string, CaseQtyBySkuRow>();
  for (const sku of values) {
    rows.set(sku.value, { caseQty: null });
  }
  if (values.length === 0) {
    return rows;
  }

  const products = await productRepo.findBySkus(organizationId, values);
  const productIds = [...new Set([...products.values()].map((product) => product.id))];
  const packagingByProductId = await packaging.findByProductIds(productIds);

  for (const sku of values) {
    const product = products.get(sku.value);
    if (product === undefined) {
      continue;
    }
    rows.set(sku.value, {
      caseQty: packagingByProductId.get(product.id)?.caseQty ?? null,
    });
  }
  return rows;
}
