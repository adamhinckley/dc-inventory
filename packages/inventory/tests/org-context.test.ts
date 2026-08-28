import {
  LocationId,
  MissingOrganizationContextError,
  OrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryInventoryUnitOfWork } from "../src/adapters/in-memory-inventory-unit-of-work.js";
import { RecordAdjustmentIncreaseUseCase } from "../src/application/record-adjustment-increase.js";
import { GetStockSnapshotUseCase } from "../src/application/get-stock-snapshot.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SKU = Sku.parse("WIDGET-1");
const LOCATION = LocationId.DEFAULT;

describe("inventory organization context fail closed (ADA-194)", () => {
  it("InMemoryStockLedger throws when organizationId is omitted from a command", async () => {
    const uow = new InMemoryInventoryUnitOfWork();
    const useCase = new RecordAdjustmentIncreaseUseCase(uow.ledger);

    await expect(
      useCase.execute({
        idempotencyKey: "missing-org",
        sku: SKU,
        quantity: 1,
        refType: "adjustment",
        refId: "missing-org",
      } as Parameters<typeof useCase.execute>[0]),
    ).rejects.toThrow(MissingOrganizationContextError);
  });

  it("GetStockSnapshotUseCase throws when organizationId is omitted", async () => {
    const uow = new InMemoryInventoryUnitOfWork();
    const useCase = new GetStockSnapshotUseCase(uow.readModel);

    await expect(
      useCase.execute({
        sku: SKU,
        locationId: LOCATION,
      } as Parameters<typeof useCase.execute>[0]),
    ).rejects.toThrow(MissingOrganizationContextError);
  });

  it("listMovements throws when organizationId is omitted from the filter", async () => {
    const uow = new InMemoryInventoryUnitOfWork();
    const adjustment = new RecordAdjustmentIncreaseUseCase(uow.ledger);
    await adjustment.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "seed",
      sku: SKU,
      quantity: 1,
      refType: "adjustment",
      refId: "seed",
      locationId: LOCATION,
    });

    await expect(
      uow.readModel.listMovements({} as Parameters<typeof uow.readModel.listMovements>[0]),
    ).rejects.toThrow(MissingOrganizationContextError);
  });
});
