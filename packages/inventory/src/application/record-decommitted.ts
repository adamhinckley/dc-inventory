import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordDecommittedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordDecommittedRequest = RecordDecommittedCommand;

export class RecordDecommittedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordDecommittedRequest): Promise<StockCommandResult> {
    return this.ledger.recordDecommitted({
      ...input,
      organizationId: input.organizationId,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
