import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordCommittedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordCommittedRequest = RecordCommittedCommand;

export class RecordCommittedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordCommittedRequest): Promise<StockCommandResult> {
    return this.ledger.recordCommitted({
      ...input,
      organizationId: input.organizationId,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
