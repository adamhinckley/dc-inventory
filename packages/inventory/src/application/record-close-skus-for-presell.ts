import type {
  CloseSkusForPresellCommand,
  CloseSkusForPresellResult,
  IStockLedger,
} from "../domain/ports/stock-ledger.js";

export type RecordCloseSkusForPresellRequest = CloseSkusForPresellCommand;

export class RecordCloseSkusForPresellUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordCloseSkusForPresellRequest): Promise<CloseSkusForPresellResult> {
    return this.ledger.closeSkusForPresell(input);
  }
}
