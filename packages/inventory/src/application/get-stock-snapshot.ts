import { LocationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IInventoryReadModel } from "../domain/ports/stock-ledger.js";
import type { StockFigures } from "../domain/snapshot.js";

export type GetStockSnapshotRequest = {
  organizationId: OrganizationId;
  sku: Sku;
  locationId?: LocationId;
};

export class GetStockSnapshotUseCase {
  constructor(private readonly readModel: IInventoryReadModel) {}

  async execute(input: GetStockSnapshotRequest): Promise<StockFigures> {
    return this.readModel.getSnapshot(
      input.sku,
      input.locationId ?? LocationId.DEFAULT,
      input.organizationId,
    );
  }
}
