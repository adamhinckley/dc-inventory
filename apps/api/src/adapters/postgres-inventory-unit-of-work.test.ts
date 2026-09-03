import { InMemoryClock } from "@dc-inventory/inventory";
import { describe, expect, it } from "vitest";
import type { AppDrizzle } from "../infrastructure/db.js";
import { PostgresInventoryUnitOfWork } from "./postgres-inventory-unit-of-work.js";
import { testShipAccountingReadPorts } from "./test-ship-accounting-readports.js";

describe("PostgresInventoryUnitOfWork read model (HTTP readers)", () => {
  it("exposes listMovements outside run so goods-received history does not 500", () => {
    const shipPorts = testShipAccountingReadPorts();
    const uow = new PostgresInventoryUnitOfWork(
      {} as AppDrizzle,
      new InMemoryClock(new Date("2026-09-02T00:00:00.000Z")),
      shipPorts.billToSnapshot,
      shipPorts.customerTerms,
    );

    expect(typeof uow.inventory.readModel.listMovements).toBe("function");
  });
});
