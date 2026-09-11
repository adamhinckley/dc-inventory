import type { Sku, SupplierId } from "@dc-inventory/shared-kernel";

export type PreOrderSkuDraftLine = Readonly<{
  sku: Sku;
  qty: number;
}>;

export type GroupPreOrderSkusBySupplierInput = Readonly<{
  lines: readonly PreOrderSkuDraftLine[];
  supplierForSku: (sku: Sku) => SupplierId | null;
}>;

export type GroupPreOrderSkusBySupplierResult = Readonly<{
  bySupplier: ReadonlyMap<SupplierId, PreOrderSkuDraftLine[]>;
  unmappedSkus: readonly string[];
}>;

/**
 * Groups draft PO lines by supplier. SKUs with no unique supplier mapping are
 * omitted from drafts and returned in `unmappedSkus`.
 */
export function groupPreOrderSkusBySupplier(
  input: GroupPreOrderSkusBySupplierInput,
): GroupPreOrderSkusBySupplierResult {
  const bySupplier = new Map<SupplierId, PreOrderSkuDraftLine[]>();
  const unmappedSkus: string[] = [];
  const seenSkus = new Set<string>();

  for (const line of input.lines) {
    const skuValue = line.sku.value;
    if (seenSkus.has(skuValue)) {
      continue;
    }
    seenSkus.add(skuValue);

    const supplierId = input.supplierForSku(line.sku);
    if (supplierId === null) {
      unmappedSkus.push(skuValue);
      continue;
    }

    const existing = bySupplier.get(supplierId);
    if (existing === undefined) {
      bySupplier.set(supplierId, [line]);
      continue;
    }
    existing.push(line);
  }

  return { bySupplier, unmappedSkus };
}
