"use client";

import {
  useListInternalCategories,
  useListInternalSuppliers,
} from "@dc-inventory/api-client-internal";
import type { FilterOption } from "@dc-inventory/ui-internal";
import { useMemo } from "react";

export function useProductListFilterOptions(): {
  category: FilterOption[];
  supplierId: FilterOption[];
  sellState: FilterOption[];
} {
  const categoriesQuery = useListInternalCategories();
  const suppliersQuery = useListInternalSuppliers({ page: 1, pageSize: 100 });

  return useMemo(() => {
    const categories =
      categoriesQuery.data?.status === 200 ? categoriesQuery.data.data.items : [];
    const suppliers =
      suppliersQuery.data?.status === 200 ? suppliersQuery.data.data.items : [];
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
