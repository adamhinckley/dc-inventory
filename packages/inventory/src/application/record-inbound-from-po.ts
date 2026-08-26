import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IStockLedger,
  RecordInboundFromPoCommand,
  StockCommandResult,
} from "../domain/ports/stock-ledger.js";

export type RecordInboundFromPoRequest = RecordInboundFromPoCommand;

export class RecordInboundFromPoUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordInboundFromPoRequest): Promise<StockCommandResult> {
    return this.ledger.recordInboundFromPo({
      ...input,
      organizationId: input.organizationId ?? OrganizationId.DEFAULT,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
