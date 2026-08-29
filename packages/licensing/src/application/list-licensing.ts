import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../domain/licensing.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";

export type ListLicensingRequest = {
  organizationId: OrganizationId;
};

export class ListLicensingSubscriptionsUseCase {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async execute(input: ListLicensingRequest): Promise<{ items: SubscriptionRecord[] }> {
    return { items: await this.repository.listSubscriptions(input.organizationId) };
  }
}

export class ListLicensingPaymentsUseCase {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async execute(input: ListLicensingRequest): Promise<{ items: SoftwarePaymentRecord[] }> {
    return { items: await this.repository.listPayments(input.organizationId) };
  }
}
