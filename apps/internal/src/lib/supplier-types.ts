import type { getInternalSupplier } from "@dc-inventory/api-client-internal";

export type SupplierDetail = Extract<
  Awaited<ReturnType<typeof getInternalSupplier>>,
  { status: 200 }
>["data"];
