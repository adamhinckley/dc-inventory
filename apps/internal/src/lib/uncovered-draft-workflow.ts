export function formatUnmappedSkusNotice(
  unmappedSkus: readonly string[],
): string | null {
  if (unmappedSkus.length === 0) {
    return null;
  }
  return `Skipped ${unmappedSkus.length} SKU(s) with no vendor mapping: ${unmappedSkus.join(", ")}`;
}

export type AfterDraftUncoveredPosResult =
  | { action: "stay"; unmappedNotice: string | null }
  | { action: "navigate"; purchaseOrderId: string };

export function shouldDraftUncoveredSelection(selectedSkuCount: number): boolean {
  return selectedSkuCount > 0;
}

export function afterDraftUncoveredPos(
  purchaseOrders: readonly { id: string }[],
  unmappedSkus: readonly string[],
): AfterDraftUncoveredPosResult {
  const unmappedNotice = formatUnmappedSkusNotice(unmappedSkus);
  if (unmappedSkus.length > 0 || purchaseOrders.length === 0) {
    return { action: "stay", unmappedNotice };
  }
  const first = purchaseOrders[0];
  if (first === undefined) {
    return { action: "stay", unmappedNotice: null };
  }
  return { action: "navigate", purchaseOrderId: first.id };
}
