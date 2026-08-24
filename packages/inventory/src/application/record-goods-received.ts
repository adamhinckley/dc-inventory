import { LocationId } from "@dc-inventory/shared-kernel";
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
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
