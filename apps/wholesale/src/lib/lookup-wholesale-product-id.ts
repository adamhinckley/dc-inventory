import { listWholesaleCatalog } from "@dc-inventory/api-client-wholesale";

export async function lookupWholesaleProductId(
  sku: string,
  name: string,
): Promise<string | null> {
  const catalog = await listWholesaleCatalog({
    q: sku,
    page: 1,
    pageSize: 25,
    availableOnly: false,
  });
  const payload = catalog.data;
  if (catalog.status !== 200 || payload === undefined || !("items" in payload)) {
    return null;
  }
  const byName = payload.items.find((item) => item.name === name);
  if (byName !== undefined) {
    return byName.id;
  }
  if (payload.items.length === 1) {
    return payload.items[0]?.id ?? null;
  }
  return null;
}
