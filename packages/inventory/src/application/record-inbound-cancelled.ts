import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordInboundCancelledCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordInboundCancelledRequest = RecordInboundCancelledCommand;

export class RecordInboundCancelledUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordInboundCancelledRequest): Promise<StockCommandResult> {
    return this.ledger.recordInboundCancelled({
      ...input,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
