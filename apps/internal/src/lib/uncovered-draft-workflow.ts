export function formatUnmappedSkusNotice(
  unmappedSkus: readonly string[],
): string | null {
  if (unmappedSkus.length === 0) {
    return null;
  }
  return `Skipped ${unmappedSkus.length} SKU(s) with no factory mapping: ${unmappedSkus.join(", ")}`;
}

export type UncoveredBatchDraftRow = Readonly<{
  purchaseOrderId: string;
  documentNumber: string;
  supplierId: string;
  supplierName: string;
  lineCount: number;
}>;

export type UncoveredDraftPurchaseOrder = Readonly<{
  id: string;
  supplierId: string;
  documentNumber: string;
  lines: readonly unknown[];
}>;

export type AfterDraftUncoveredPosResult =
  | { action: "stay"; unmappedNotice: string | null }
  | { action: "navigate"; purchaseOrderId: string }
  | {
      action: "modal";
      drafts: readonly UncoveredBatchDraftRow[];
      unmappedNotice: string | null;
    };

export function shouldDraftUncoveredSelection(selectedCount: number): boolean {
  return selectedCount > 0;
}

export function draftableUncoveredFactoryIds(
  rows: readonly { id: string; needsMapping: boolean }[],
): string[] {
  return rows.filter((row) => !row.needsMapping).map((row) => row.id);
}

export function toUncoveredBatchDraftRows(
  purchaseOrders: readonly UncoveredDraftPurchaseOrder[],
  supplierNamesById: ReadonlyMap<string, string>,
): readonly UncoveredBatchDraftRow[] {
  return purchaseOrders.map((order) => ({
    purchaseOrderId: order.id,
    documentNumber: order.documentNumber,
    supplierId: order.supplierId,
    supplierName: supplierNamesById.get(order.supplierId) ?? order.supplierId,
    lineCount: order.lines.length,
  }));
}

export function afterDraftUncoveredPos(
  purchaseOrders: readonly UncoveredDraftPurchaseOrder[],
  unmappedSkus: readonly string[],
  supplierNamesById: ReadonlyMap<string, string> = new Map(),
): AfterDraftUncoveredPosResult {
  const unmappedNotice = formatUnmappedSkusNotice(unmappedSkus);

  if (purchaseOrders.length === 0) {
    return { action: "stay", unmappedNotice };
  }

  if (purchaseOrders.length === 1 && unmappedSkus.length === 0) {
    const first = purchaseOrders[0];
    if (first === undefined) {
      return { action: "stay", unmappedNotice: null };
    }
    return { action: "navigate", purchaseOrderId: first.id };
  }

  return {
    action: "modal",
    drafts: toUncoveredBatchDraftRows(purchaseOrders, supplierNamesById),
    unmappedNotice,
  };
}
