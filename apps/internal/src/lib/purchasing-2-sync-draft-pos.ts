import {
  getListInternalPurchaseOrdersQueryKey,
  syncInternalPurchaseOrdersFromUncovered,
} from "@dc-inventory/api-client-internal";
import type { QueryClient } from "@tanstack/react-query";

export async function syncPurchasing2DraftPurchaseOrders(
  queryClient: QueryClient,
  supplierIds?: readonly string[],
): Promise<boolean> {
  const result = await syncInternalPurchaseOrdersFromUncovered({
    supplierIds: supplierIds === undefined ? undefined : [...supplierIds],
  });
  if (result.status !== 200) {
    return false;
  }
  await queryClient.invalidateQueries({
    queryKey: getListInternalPurchaseOrdersQueryKey(),
  });
  return true;
}
