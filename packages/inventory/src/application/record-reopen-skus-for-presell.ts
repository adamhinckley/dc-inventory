import type {
  DemandCommandResult,
  IStockLedger,
  ReopenSkusForPresellCommand,
} from "../domain/ports/stock-ledger.js";

export type RecordReopenSkusForPresellRequest = ReopenSkusForPresellCommand;

export class RecordReopenSkusForPresellUseCase {
  constructor(private readonly ledger: IStockLedger) {}

  async execute(input: RecordReopenSkusForPresellRequest): Promise<DemandCommandResult> {
    return this.ledger.reopenSkusForPresell(input);
  }
}
