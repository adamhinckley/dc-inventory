import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import {
  deriveCustomerPaymentRows,
  type CustomerPaymentProjectionRow,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";

export type ListCustomerPaymentsRequest = {
  readonly organizationId: OrganizationId;
  readonly customerId: CustomerId;
  readonly asOf: Date;
};

export type ListCustomerPaymentsResult = {
  readonly items: readonly CustomerPaymentProjectionRow[];
};

export class ListCustomerPaymentsUseCase {
  constructor(private readonly arCustomerRead: IArCustomerReadPort) {}

  async execute(input: ListCustomerPaymentsRequest): Promise<ListCustomerPaymentsResult> {
    const loaded = await this.arCustomerRead.loadCustomerData(
      input.organizationId,
      input.customerId,
    );
    return {
      items: deriveCustomerPaymentRows(loaded, input.asOf),
    };
  }
}
