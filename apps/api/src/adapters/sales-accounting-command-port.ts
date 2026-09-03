import type { IAccountingCommandPort } from "@dc-inventory/sales";
import {
  CreateInvoiceForOrderAdapter,
  type ICustomerBillToSnapshotReadPort,
  type ICustomerTermsReadPort,
  type IClock,
  type IInvoiceRepository,
} from "@dc-inventory/accounting";

export class SalesInvoiceAccountingCommandAdapter implements IAccountingCommandPort {
  private readonly adapter: CreateInvoiceForOrderAdapter;

  constructor(
    invoices: IInvoiceRepository,
    billToSnapshot: ICustomerBillToSnapshotReadPort,
    customerTerms: ICustomerTermsReadPort,
    clock?: IClock,
  ) {
    this.adapter = new CreateInvoiceForOrderAdapter(
      invoices,
      billToSnapshot,
      customerTerms,
      clock,
    );
  }

  createInvoiceForOrder(
    command: Parameters<IAccountingCommandPort["createInvoiceForOrder"]>[0],
  ): ReturnType<IAccountingCommandPort["createInvoiceForOrder"]> {
    return this.adapter.createInvoiceForOrder(command);
  }
}
