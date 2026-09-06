import { listInternalUncoveredSkus } from "@dc-inventory/api-client-internal";

type UncoveredSkuListParams = NonNullable<
  Parameters<typeof listInternalUncoveredSkus>[0]
>;
import { isUncoveredNeedsMappingFactoryId } from "./uncovered-constants";

const MAX_PAGE_SIZE = 100;

async function listAllUncoveredSkus(
  params: UncoveredSkuListParams,
): Promise<readonly string[]> {
  const skus: string[] = [];
  let page = 1;

  while (true) {
    const response = await listInternalUncoveredSkus({
      ...params,
      page,
      pageSize: MAX_PAGE_SIZE,
    });
    if (response.status !== 200) {
      break;
    }
    for (const item of response.data.items) {
      skus.push(item.sku);
    }
    const fetched = page * response.data.pageSize;
    if (fetched >= response.data.total) {
      break;
    }
    page += 1;
  }

  return skus;
}

/** Collects every uncovered SKU for draftable factory rows (excludes needs-mapping). */
export async function collectUncoveredSkusForFactories(
  factoryIds: readonly string[],
): Promise<readonly string[]> {
  const skus: string[] = [];

  for (const factoryId of factoryIds) {
    if (isUncoveredNeedsMappingFactoryId(factoryId)) {
      continue;
    }
    const factorySkus = await listAllUncoveredSkus({ supplierId: factoryId });
    skus.push(...factorySkus);
  }

  return skus;
}
