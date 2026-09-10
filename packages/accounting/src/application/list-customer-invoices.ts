import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import {
  deriveCustomerInvoiceRows,
  type CustomerInvoiceProjectionRow,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";

export type ListCustomerInvoicesRequest = {
  readonly organizationId: OrganizationId;
  readonly customerId: CustomerId;
  readonly asOf: Date;
  readonly includePaid: boolean;
};

export type ListCustomerInvoicesResult = {
  readonly items: readonly CustomerInvoiceProjectionRow[];
};

export class ListCustomerInvoicesUseCase {
  constructor(private readonly arCustomerRead: IArCustomerReadPort) {}

  async execute(input: ListCustomerInvoicesRequest): Promise<ListCustomerInvoicesResult> {
    const loaded = await this.arCustomerRead.loadCustomerData(
      input.organizationId,
      input.customerId,
    );
    return {
      items: deriveCustomerInvoiceRows(loaded, input.asOf, input.includePaid),
    };
  }
}
