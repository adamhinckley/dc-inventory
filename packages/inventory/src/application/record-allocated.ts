import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordAllocatedCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordAllocatedRequest = RecordAllocatedCommand;

export class RecordAllocatedUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordAllocatedRequest): Promise<StockCommandResult> {
    return this.ledger.recordAllocated({
      ...input,
      organizationId: input.organizationId ?? OrganizationId.DEFAULT,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
