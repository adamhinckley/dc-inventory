import { listInternalPreOrderFactories } from "@dc-inventory/api-client-internal";
import {
  PRE_ORDER_FACTORY_LIST_PAGE_SIZE,
  type PreOrderFactoryListFn,
  type UncoveredFactoryRow,
} from "./list-all-uncovered-factories";

export async function listPurchasing2PreOrderFactories(
  listFactories: PreOrderFactoryListFn = listInternalPreOrderFactories,
): Promise<UncoveredFactoryRow[]> {
  const items: UncoveredFactoryRow[] = [];
  let page = 1;

  while (true) {
    const response = await listFactories({
      page,
      pageSize: PRE_ORDER_FACTORY_LIST_PAGE_SIZE,
      excludeSuppliersWithOpenDraft: "true",
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
