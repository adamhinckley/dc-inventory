import { listInternalPreOrderSkus } from "@dc-inventory/api-client-internal";
import { isPreOrderNeedsMappingFactoryId } from "./uncovered-constants";
import { PRE_ORDER_FACTORY_LIST_PAGE_SIZE } from "./list-all-uncovered-factories";

type PreOrderSkuListParams = NonNullable<
  Parameters<typeof listInternalPreOrderSkus>[0]
>;

type PreOrderSkuListFn = (
  params: PreOrderSkuListParams,
) => Promise<Awaited<ReturnType<typeof listInternalPreOrderSkus>>>;

async function listAllPreOrderSkus(
  params: PreOrderSkuListParams,
  listSkus: PreOrderSkuListFn = listInternalPreOrderSkus,
): Promise<readonly string[]> {
  const skus: string[] = [];
  let page = 1;

  while (true) {
    const response = await listSkus({
      ...params,
      page,
      pageSize: PRE_ORDER_FACTORY_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load toOrder SKUs.");
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

/** Collects every toOrder SKU for draftable factory rows (excludes needs-mapping). */
export async function collectPreOrderSkusForFactories(
  factoryIds: readonly string[],
  listSkus: PreOrderSkuListFn = listInternalPreOrderSkus,
): Promise<readonly string[]> {
  const skus: string[] = [];

  for (const factoryId of factoryIds) {
    if (isPreOrderNeedsMappingFactoryId(factoryId)) {
      continue;
    }
    const factorySkus = await listAllPreOrderSkus({ supplierId: factoryId }, listSkus);
    skus.push(...factorySkus);
  }

  return skus;
}
