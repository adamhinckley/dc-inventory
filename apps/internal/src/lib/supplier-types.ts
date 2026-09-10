import type {
  getInternalSupplier,
  listInternalSuppliers,
} from "@dc-inventory/api-client-internal";

export type SupplierDetail = Extract<
  Awaited<ReturnType<typeof getInternalSupplier>>,
  { status: 200 }
>["data"];

export type SupplierRow = Extract<
  Awaited<ReturnType<typeof listInternalSuppliers>>,
  { status: 200 }
>["data"]["items"][number];
