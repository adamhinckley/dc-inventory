import type { listInternalProducts } from "@dc-inventory/api-client-internal";

export type CatalogProductRow = Extract<
  Awaited<ReturnType<typeof listInternalProducts>>,
  { status: 200 }
>["data"]["items"][number];
