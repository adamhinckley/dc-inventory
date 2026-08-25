import type { IInvoiceRepository } from "@dc-inventory/accounting";
import { AccountingCommandAdapter, type IClock } from "@dc-inventory/sales";
import type {
  AccountingCommandResult,
  CreateInvoiceForOrderCommand,
  IAccountingCommandPort,
} from "@dc-inventory/sales";

export class SalesInvoiceAccountingCommandAdapter implements IAccountingCommandPort {
  private readonly adapter: AccountingCommandAdapter;

  constructor(invoices: IInvoiceRepository, clock?: IClock) {
    this.adapter = new AccountingCommandAdapter(invoices, clock);
  }

  createInvoiceForOrder(command: CreateInvoiceForOrderCommand): Promise<AccountingCommandResult> {
    return this.adapter.createInvoiceForOrder(command);
  }
}
