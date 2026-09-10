import {
  getGetInternalCustomerAccountingWorkspaceQueryKey,
  getListInternalAccountingPaymentsQueryKey,
} from "@dc-inventory/api-client-internal";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateCustomerAccountingQueries(
  queryClient: QueryClient,
  customerId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: getGetInternalCustomerAccountingWorkspaceQueryKey(customerId),
    }),
    queryClient.invalidateQueries({
      queryKey: getListInternalAccountingPaymentsQueryKey(),
    }),
  ]);
}
