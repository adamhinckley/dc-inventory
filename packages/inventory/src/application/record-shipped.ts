import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordShippedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordShippedRequest = RecordShippedCommand;

export class RecordShippedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordShippedRequest): Promise<StockCommandResult> {
    return this.ledger.recordShipped({
      ...input,
      organizationId: input.organizationId,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
