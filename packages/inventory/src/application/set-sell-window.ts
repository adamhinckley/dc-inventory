import { LocationId } from "@dc-inventory/shared-kernel";
import type {
  DemandCommandResult,
  IStockLedger,
  SetSellWindowCommand,
} from "../domain/ports/stock-ledger.js";

export type SetSellWindowRequest = SetSellWindowCommand;

export class SetSellWindowUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: SetSellWindowRequest): Promise<DemandCommandResult> {
    return this.ledger.setSellWindow({
      ...input,
      locationId: input.locationId ?? LocationId.DEFAULT,
    });
  }
}
