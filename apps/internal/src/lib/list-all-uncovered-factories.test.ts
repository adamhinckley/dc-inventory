import { describe, expect, it, vi } from "vitest";
import {
  listAllPreOrderFactories,
  PRE_ORDER_FACTORY_LIST_PAGE_SIZE,
  type PreOrderFactoryListFn,
} from "./list-all-uncovered-factories";

describe("listAllPreOrderFactories", () => {
  it("pages through factories until the reported total is loaded", async () => {
    const listFactoriesMock = vi.fn(async (params: { page?: number; pageSize?: number }) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? PRE_ORDER_FACTORY_LIST_PAGE_SIZE;
      const total = 150;
      const start = (page - 1) * pageSize;
      const count = Math.min(pageSize, Math.max(0, total - start));
      return {
        status: 200 as const,
        data: {
          items: Array.from({ length: count }, (_, index) => ({
            id: `factory-${start + index + 1}`,
            supplierId: `factory-${start + index + 1}`,
            supplierNumber: `F${start + index + 1}`,
            supplierName: `Factory ${start + index + 1}`,
            poPrefix: "FA",
            productCount: 1,
            totalToOrderUnits: 10,
            needsMapping: false,
          })),
          page,
          pageSize,
          total,
        },
      };
    });
    const listFactories = listFactoriesMock as unknown as PreOrderFactoryListFn;

    const factories = await listAllPreOrderFactories(listFactories);

    expect(listFactoriesMock.mock.calls.map((call) => call[0]?.page)).toEqual([1, 2]);
    expect(factories).toHaveLength(150);
    expect(factories[0]?.supplierName).toBe("Factory 1");
    expect(factories.at(-1)?.supplierName).toBe("Factory 150");
  });

  it("throws when a page request fails", async () => {
    const listFactories = vi.fn(async () => ({
      status: 403 as const,
      data: { error: "forbidden" as const },
    })) as unknown as PreOrderFactoryListFn;

    await expect(listAllPreOrderFactories(listFactories)).rejects.toThrow(
      "Could not load toOrder factories.",
    );
  });
});
