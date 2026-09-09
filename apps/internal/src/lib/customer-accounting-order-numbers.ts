import {
  getGetInternalSalesOrderQueryKey,
  getInternalSalesOrder,
} from "@dc-inventory/api-client-internal";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

export function useCustomerAccountingOrderNumbers(orderIds: readonly string[]) {
  const uniqueOrderIds = useMemo(
    () => [...new Set(orderIds.filter((orderId) => orderId.length > 0))],
    [orderIds],
  );

  const queries = useQueries({
    queries: uniqueOrderIds.map((orderId) => ({
      queryKey: getGetInternalSalesOrderQueryKey(orderId),
      queryFn: () => getInternalSalesOrder(orderId),
      staleTime: 60_000,
    })),
  });

  const orderNumbers = useMemo(() => {
    const resolved = new Map<string, string>();
    uniqueOrderIds.forEach((orderId, index) => {
      const response = queries[index]?.data;
      if (response?.status === 200) {
        resolved.set(orderId, response.data.documentNumber);
      }
    });
    return resolved;
  }, [queries, uniqueOrderIds]);

  const pendingOrderIds = useMemo(() => {
    const pending = new Set<string>();
    uniqueOrderIds.forEach((orderId, index) => {
      if (queries[index]?.isPending) {
        pending.add(orderId);
      }
    });
    return pending;
  }, [queries, uniqueOrderIds]);

  return { orderNumbers, pendingOrderIds };
}
