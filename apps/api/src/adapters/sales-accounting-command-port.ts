import type { IInvoiceRepository } from "@dc-inventory/accounting";
import { AccountingCommandAdapter } from "@dc-inventory/sales";
import type {
  AccountingCommandResult,
  CreateInvoiceForOrderCommand,
  IAccountingCommandPort,
} from "@dc-inventory/sales";

export class SalesInvoiceAccountingCommandAdapter implements IAccountingCommandPort {
  private readonly adapter: AccountingCommandAdapter;

  constructor(invoices: IInvoiceRepository) {
    this.adapter = new AccountingCommandAdapter(invoices);
  }

  createInvoiceForOrder(command: CreateInvoiceForOrderCommand): Promise<AccountingCommandResult> {
    return this.adapter.createInvoiceForOrder(command);
  }
}
