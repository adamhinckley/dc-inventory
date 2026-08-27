import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  InMemoryLicensingStore,
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../licensing/in-memory-licensing.js";

export type ListLicensingSubscriptionsRequest = {
  organizationId: OrganizationId;
};

export type ListLicensingSubscriptionsResult = {
  items: SubscriptionRecord[];
};

export class ListLicensingSubscriptionsUseCase {
  constructor(private readonly store: InMemoryLicensingStore) {}

  async execute(
    input: ListLicensingSubscriptionsRequest,
  ): Promise<ListLicensingSubscriptionsResult> {
    return { items: this.store.listSubscriptions(input.organizationId) };
  }
}

export type ListLicensingPaymentsRequest = {
  organizationId: OrganizationId;
};

export type ListLicensingPaymentsResult = {
  items: SoftwarePaymentRecord[];
};

export class ListLicensingPaymentsUseCase {
  constructor(private readonly store: InMemoryLicensingStore) {}

  async execute(input: ListLicensingPaymentsRequest): Promise<ListLicensingPaymentsResult> {
    return { items: this.store.listPayments(input.organizationId) };
  }
}
