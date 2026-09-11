import { listInternalPreOrderFactories } from "@dc-inventory/api-client-internal";

export const PRE_ORDER_FACTORY_LIST_PAGE_SIZE = 100;

type ListInternalPreOrderFactoriesParams = NonNullable<
  Parameters<typeof listInternalPreOrderFactories>[0]
>;

export type PreOrderFactoryListFn = (
  params: ListInternalPreOrderFactoriesParams,
) => Promise<Awaited<ReturnType<typeof listInternalPreOrderFactories>>>;

export type UncoveredFactoryRow = {
  id: string;
  supplierId: string | null;
  supplierNumber: string | null;
  supplierName: string;
  poPrefix: string | null;
  productCount: number;
  totalToOrderUnits: number;
  needsMapping: boolean;
};

export async function listAllPreOrderFactories(
  listFactories: PreOrderFactoryListFn = listInternalPreOrderFactories,
): Promise<UncoveredFactoryRow[]> {
  const items: UncoveredFactoryRow[] = [];
  let page = 1;

  while (true) {
    const response = await listFactories({
      page,
      pageSize: PRE_ORDER_FACTORY_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load toOrder factories.");
    }
    items.push(...response.data.items);
    const loadedThrough = response.data.page * response.data.pageSize;
    if (loadedThrough >= response.data.total) {
      return items;
    }
    page += 1;
  }
}
