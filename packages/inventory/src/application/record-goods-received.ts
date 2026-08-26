import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordGoodsReceivedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordGoodsReceivedRequest = RecordGoodsReceivedCommand;

export class RecordGoodsReceivedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordGoodsReceivedRequest): Promise<StockCommandResult> {
    return this.ledger.recordGoodsReceived({
      ...input,
      organizationId: input.organizationId ?? OrganizationId.DEFAULT,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
