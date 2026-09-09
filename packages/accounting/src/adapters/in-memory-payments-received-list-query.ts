import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IAccountingRepository } from "../domain/ports/invoice-repository.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type {
  IPaymentsReceivedListQuery,
  PaymentsReceivedListPage,
  PaymentsReceivedListQuery,
} from "../domain/ports/payments-received-list-query.js";
import {
  buildPaymentReceivedRow,
  listPaymentsReceivedInMemory,
} from "./ar-read-support.js";

export class InMemoryPaymentsReceivedListQuery implements IPaymentsReceivedListQuery {
  constructor(
    private readonly repository: IAccountingRepository,
    private readonly customerProfiles: ICustomerArProfileReadPort,
  ) {}

  async list(query: PaymentsReceivedListQuery): Promise<PaymentsReceivedListPage> {
    const profiles = await this.customerProfiles.listAll(query.organizationId);
    const profileByCustomerId = new Map(
      profiles.map((profile) => [profile.customerId, profile]),
    );
    const rows = [];

    for (const profile of profiles) {
      const payments = await this.repository.listPaymentsByCustomer(
        query.organizationId,
        profile.customerId,
      );
      for (const payment of payments) {
        const applications = await this.repository.listApplicationsByPayment(
          query.organizationId,
          payment.id,
        );
        rows.push(buildPaymentReceivedRow(payment, applications, profile));
      }
    }

    void profileByCustomerId;
    void query.organizationId;
    return listPaymentsReceivedInMemory(rows, query);
  }
}
