import type { listInternalSupplierProducts } from "@dc-inventory/api-client-internal";

export type SupplierProductRow = Extract<
  Awaited<ReturnType<typeof listInternalSupplierProducts>>,
  { status: 200 }
>["data"]["items"][number];

export type SupplierProductsListParams = {
  page?: number;
  pageSize?: number;
};
