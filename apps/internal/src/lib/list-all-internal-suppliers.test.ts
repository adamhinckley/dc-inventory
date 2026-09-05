import { describe, expect, it, vi } from "vitest";
import {
  INTERNAL_SUPPLIER_LIST_PAGE_SIZE,
  listAllInternalSuppliers,
  type InternalSupplierListFn,
} from "./list-all-internal-suppliers";

describe("listAllInternalSuppliers", () => {
  it("pages through suppliers until the reported total is loaded", async () => {
    const listSuppliersMock = vi.fn(async (params: { page?: number; pageSize?: number }) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? INTERNAL_SUPPLIER_LIST_PAGE_SIZE;
      const total = 250;
      const start = (page - 1) * pageSize;
      const count = Math.min(pageSize, Math.max(0, total - start));
      return {
        status: 200 as const,
        data: {
          items: Array.from({ length: count }, (_, index) => ({
            id: `supplier-${start + index + 1}`,
            vendorNumber: `V${start + index + 1}`,
            name: `Factory ${start + index + 1}`,
          })),
          page,
          pageSize,
          total,
        },
      };
    });
    const listSuppliers = listSuppliersMock as unknown as InternalSupplierListFn;

    const suppliers = await listAllInternalSuppliers(listSuppliers);

    expect(listSuppliersMock.mock.calls.map((call) => call[0]?.page)).toEqual([1, 2, 3]);
    expect(suppliers).toHaveLength(250);
    expect(suppliers[0]?.vendorNumber).toBe("V1");
    expect(suppliers.at(-1)?.vendorNumber).toBe("V250");
  });
});
