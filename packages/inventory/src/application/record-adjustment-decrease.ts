import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
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
      organizationId: input.organizationId ?? OrganizationId.DEFAULT,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
