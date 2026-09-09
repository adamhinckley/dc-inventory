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

  return useMemo(() => {
    const orderNumbers = new Map<string, string>();
    uniqueOrderIds.forEach((orderId, index) => {
      const response = queries[index]?.data;
      if (response?.status === 200) {
        orderNumbers.set(orderId, response.data.documentNumber);
      }
    });
    return orderNumbers;
  }, [queries, uniqueOrderIds]);
}
