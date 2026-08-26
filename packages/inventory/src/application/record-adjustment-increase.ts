import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordAdjustmentIncreaseCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordAdjustmentIncreaseRequest = RecordAdjustmentIncreaseCommand;

export class RecordAdjustmentIncreaseUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordAdjustmentIncreaseRequest): Promise<StockCommandResult> {
    return this.ledger.recordAdjustmentIncrease({
      ...input,
      organizationId: input.organizationId ?? OrganizationId.DEFAULT,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
