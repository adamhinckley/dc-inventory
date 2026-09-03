import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { ICustomerBillToSnapshotReadPort } from "../domain/ports/customer-bill-to-snapshot-read.js";
import type { ICustomerTermsReadPort } from "../domain/ports/customer-terms-read.js";
import type { IAccountingUnitOfWork } from "../domain/ports/invoice-repository.js";
import type { Invoice } from "../domain/invoice.js";
import { createPostedInvoice } from "./create-posted-invoice.js";

export type CreateInvoiceRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type CreateInvoiceResult =
  | { ok: true; invoice: Invoice; created: boolean }
  | { ok: false; reason: "invalid" };

export class CreateInvoiceUseCase {
  constructor(
    private readonly unitOfWork: IAccountingUnitOfWork,
    private readonly billToSnapshot: ICustomerBillToSnapshotReadPort,
    private readonly customerTerms: ICustomerTermsReadPort,
    private readonly clock?: IClock,
  ) {}

  async execute(input: CreateInvoiceRequest): Promise<CreateInvoiceResult> {
    void input.staffUserId;
    return this.unitOfWork.run((uow) =>
      createPostedInvoice(
        {
          organizationId: input.organizationId,
          orderId: input.orderId,
          customerId: input.customerId,
          subtotalCents: input.subtotalCents,
          currency: input.currency,
        },
        {
          invoices: uow.invoices,
          billToSnapshot: this.billToSnapshot,
          customerTerms: this.customerTerms,
          clock: this.clock,
        },
      ),
    );
  }
}
