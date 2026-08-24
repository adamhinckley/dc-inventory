import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordDeallocatedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordDeallocatedRequest = RecordDeallocatedCommand;

export class RecordDeallocatedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordDeallocatedRequest): Promise<StockCommandResult> {
    return this.ledger.recordDeallocated({
      ...input,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
