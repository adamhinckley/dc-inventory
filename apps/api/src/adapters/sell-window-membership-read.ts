import { hasActiveSellWindowMembership, type ISellWindowRepository } from "@dc-inventory/inventory";
import { OrganizationId, type Sku } from "@dc-inventory/shared-kernel";

/** Resolves active SellWindow membership per SKU for in-memory qty-read adapters. */
export async function readActiveSellWindowMembershipBySkus(
  sellWindows: ISellWindowRepository,
  organizationId: OrganizationId,
  skus: readonly Sku[],
  now: Date,
): Promise<ReadonlyMap<string, boolean>> {
  const result = new Map<string, boolean>();
  if (skus.length === 0) {
    return result;
  }
  const requested = new Set(skus.map((sku) => sku.value));
  const timingsBySku = new Map<
    string,
    Array<{
      windowOpensAt: Date | null;
      windowClosesAt: Date;
      manuallyClosedAt: Date | null;
    }>
  >();

  const page = await sellWindows.list({
    organizationId,
    page: 1,
    pageSize: 10_000,
    sortBy: "appliedAt",
    sortOrder: "asc",
  });
  for (const listed of page.items) {
    const detail = await sellWindows.findById(organizationId, listed.id);
    if (detail === null) {
      continue;
    }
    const timing = {
      windowOpensAt: detail.windowOpensAt,
      windowClosesAt: detail.windowClosesAt,
      manuallyClosedAt: detail.manuallyClosedAt,
    };
    for (const sku of detail.skus) {
      if (!requested.has(sku.value)) {
        continue;
      }
      const timings = timingsBySku.get(sku.value) ?? [];
      timings.push(timing);
      timingsBySku.set(sku.value, timings);
    }
  }
  for (const sku of skus) {
    const timings = timingsBySku.get(sku.value) ?? [];
    result.set(sku.value, hasActiveSellWindowMembership(timings, now));
  }
  return result;
}
