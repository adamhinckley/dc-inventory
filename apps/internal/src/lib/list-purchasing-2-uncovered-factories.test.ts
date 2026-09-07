import { describe, expect, it, vi } from "vitest";
import {
  UNCOVERED_FACTORY_LIST_PAGE_SIZE,
  type UncoveredFactoryListFn,
} from "./list-all-uncovered-factories";
import { listPurchasing2UncoveredFactories } from "./list-purchasing-2-uncovered-factories";

describe("listPurchasing2UncoveredFactories", () => {
  it("requests factories with excludeSuppliersWithOpenDraft enabled", async () => {
    const listFactoriesMock = vi.fn(async () => ({
      status: 200 as const,
      data: {
        items: [
          {
            id: "factory-1",
            supplierId: "factory-1",
            supplierNumber: "F1",
            supplierName: "Factory 1",
            productCount: 1,
            totalUncoveredUnits: 10,
            needsMapping: false,
          },
        ],
        page: 1,
        pageSize: UNCOVERED_FACTORY_LIST_PAGE_SIZE,
        total: 1,
      },
    }));
    const listFactories = listFactoriesMock as unknown as UncoveredFactoryListFn;

    const factories = await listPurchasing2UncoveredFactories(listFactories);

    expect(listFactoriesMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: UNCOVERED_FACTORY_LIST_PAGE_SIZE,
      excludeSuppliersWithOpenDraft: "true",
    });
    expect(factories).toHaveLength(1);
    expect(factories[0]?.supplierName).toBe("Factory 1");
  });
});
