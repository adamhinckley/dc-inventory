"use client";

import {
  getListInternalSuppliersQueryKey,
  useListInternalCategories,
} from "@dc-inventory/api-client-internal";
import type { FilterOption } from "@dc-inventory/ui-internal";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listAllInternalSuppliers } from "./list-all-internal-suppliers";

export function useProductListFilterOptions(): {
  category: FilterOption[];
  supplierId: FilterOption[];
  sellState: FilterOption[];
} {
  const categoriesQuery = useListInternalCategories();
  const suppliersQuery = useQuery({
    queryKey: [...getListInternalSuppliersQueryKey(), "all-filter-options"],
    queryFn: () => listAllInternalSuppliers(),
  });

  return useMemo(() => {
    const categories =
      categoriesQuery.data?.status === 200 ? categoriesQuery.data.data.items : [];
    const suppliers = suppliersQuery.data ?? [];
    return {
      category: categories.map((category) => ({
        value: category.name,
        label: category.name,
      })),
      supplierId: suppliers.map((supplier) => ({
        value: supplier.id,
        label: `${supplier.vendorNumber} — ${supplier.name}`,
      })),
      sellState: [
        { value: "open", label: "Open" },
        { value: "locked", label: "Locked" },
      ],
    };
  }, [categoriesQuery.data, suppliersQuery.data]);
}
