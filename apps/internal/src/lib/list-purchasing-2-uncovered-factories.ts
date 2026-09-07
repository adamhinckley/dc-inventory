import { listInternalUncoveredFactories } from "@dc-inventory/api-client-internal";
import {
  UNCOVERED_FACTORY_LIST_PAGE_SIZE,
  type UncoveredFactoryListFn,
  type UncoveredFactoryRow,
} from "./list-all-uncovered-factories";

export async function listPurchasing2UncoveredFactories(
  listFactories: UncoveredFactoryListFn = listInternalUncoveredFactories,
): Promise<UncoveredFactoryRow[]> {
  const items: UncoveredFactoryRow[] = [];
  let page = 1;

  while (true) {
    const response = await listFactories({
      page,
      pageSize: UNCOVERED_FACTORY_LIST_PAGE_SIZE,
      excludeSuppliersWithOpenDraft: "true",
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
