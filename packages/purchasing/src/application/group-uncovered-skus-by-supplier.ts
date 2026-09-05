import type { Sku, SupplierId } from "@dc-inventory/shared-kernel";

export type UncoveredSkuDraftLine = Readonly<{
  sku: Sku;
  qty: number;
}>;

export type GroupUncoveredSkusBySupplierInput = Readonly<{
  lines: readonly UncoveredSkuDraftLine[];
  supplierForSku: (sku: Sku) => SupplierId | null;
}>;

export type GroupUncoveredSkusBySupplierResult = Readonly<{
  bySupplier: ReadonlyMap<SupplierId, UncoveredSkuDraftLine[]>;
  unmappedSkus: readonly string[];
}>;

/**
 * Groups draft PO lines by supplier. SKUs with no unique supplier mapping are
 * omitted from drafts and returned in `unmappedSkus`.
 */
export function groupUncoveredSkusBySupplier(
  input: GroupUncoveredSkusBySupplierInput,
): GroupUncoveredSkusBySupplierResult {
  const bySupplier = new Map<SupplierId, UncoveredSkuDraftLine[]>();
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
