import { listInternalUncoveredSkus } from "@dc-inventory/api-client-internal";
import { isUncoveredNeedsMappingFactoryId } from "./uncovered-constants";
import { UNCOVERED_FACTORY_LIST_PAGE_SIZE } from "./list-all-uncovered-factories";

type UncoveredSkuListParams = NonNullable<
  Parameters<typeof listInternalUncoveredSkus>[0]
>;

type UncoveredSkuListFn = (
  params: UncoveredSkuListParams,
) => Promise<Awaited<ReturnType<typeof listInternalUncoveredSkus>>>;

async function listAllUncoveredSkus(
  params: UncoveredSkuListParams,
  listSkus: UncoveredSkuListFn = listInternalUncoveredSkus,
): Promise<readonly string[]> {
  const skus: string[] = [];
  let page = 1;

  while (true) {
    const response = await listSkus({
      ...params,
      page,
      pageSize: UNCOVERED_FACTORY_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load uncovered SKUs.");
    }
    for (const item of response.data.items) {
      skus.push(item.sku);
    }
    const loadedThrough = response.data.page * response.data.pageSize;
    if (loadedThrough >= response.data.total) {
      return skus;
    }
    page += 1;
  }
}

/** Collects every uncovered SKU for draftable factory rows (excludes needs-mapping). */
export async function collectUncoveredSkusForFactories(
  factoryIds: readonly string[],
  listSkus: UncoveredSkuListFn = listInternalUncoveredSkus,
): Promise<readonly string[]> {
  const skus: string[] = [];

  for (const factoryId of factoryIds) {
    if (isUncoveredNeedsMappingFactoryId(factoryId)) {
      continue;
    }
    const factorySkus = await listAllUncoveredSkus({ supplierId: factoryId }, listSkus);
    skus.push(...factorySkus);
  }

  return skus;
}
