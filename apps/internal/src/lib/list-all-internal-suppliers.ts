import { listInternalSuppliers } from "@dc-inventory/api-client-internal";

export const INTERNAL_SUPPLIER_LIST_PAGE_SIZE = 100;

type ListInternalSuppliersParams = NonNullable<Parameters<typeof listInternalSuppliers>[0]>;

export type InternalSupplierListFn = (
  params: ListInternalSuppliersParams,
) => Promise<Awaited<ReturnType<typeof listInternalSuppliers>>>;

export type InternalSupplierFilterOption = {
  id: string;
  vendorNumber: string;
  name: string;
};

export async function listAllInternalSuppliers(
  listSuppliers: InternalSupplierListFn = listInternalSuppliers,
): Promise<InternalSupplierFilterOption[]> {
  const items: InternalSupplierFilterOption[] = [];
  let page = 1;
  while (true) {
    const response = await listSuppliers({
      page,
      pageSize: INTERNAL_SUPPLIER_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load suppliers.");
    }
    items.push(...response.data.items);
    const loadedThrough = response.data.page * response.data.pageSize;
    if (loadedThrough >= response.data.total) {
      return items;
    }
    page += 1;
  }
}
