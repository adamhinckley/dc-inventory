import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordAdjustmentDecreaseCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordAdjustmentDecreaseRequest = RecordAdjustmentDecreaseCommand;

export class RecordAdjustmentDecreaseUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordAdjustmentDecreaseRequest): Promise<StockCommandResult> {
    return this.ledger.recordAdjustmentDecrease({
      ...input,
      organizationId: input.organizationId,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
