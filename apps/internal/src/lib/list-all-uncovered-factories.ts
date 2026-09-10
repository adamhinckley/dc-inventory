import { listInternalUncoveredFactories } from "@dc-inventory/api-client-internal";

export const UNCOVERED_FACTORY_LIST_PAGE_SIZE = 100;

type ListInternalUncoveredFactoriesParams = NonNullable<
  Parameters<typeof listInternalUncoveredFactories>[0]
>;

export type UncoveredFactoryListFn = (
  params: ListInternalUncoveredFactoriesParams,
) => Promise<Awaited<ReturnType<typeof listInternalUncoveredFactories>>>;

export type UncoveredFactoryRow = {
  id: string;
  supplierId: string | null;
  supplierNumber: string | null;
  supplierName: string;
  poPrefix: string | null;
  productCount: number;
  totalUncoveredUnits: number;
  needsMapping: boolean;
};

export async function listAllUncoveredFactories(
  listFactories: UncoveredFactoryListFn = listInternalUncoveredFactories,
): Promise<UncoveredFactoryRow[]> {
  const items: UncoveredFactoryRow[] = [];
  let page = 1;

  while (true) {
    const response = await listFactories({
      page,
      pageSize: UNCOVERED_FACTORY_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load uncovered factories.");
    }
    items.push(...response.data.items);
    const loadedThrough = response.data.page * response.data.pageSize;
    if (loadedThrough >= response.data.total) {
      return items;
    }
    page += 1;
  }
}
