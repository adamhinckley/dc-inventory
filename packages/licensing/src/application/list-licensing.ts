import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../domain/licensing.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";

export type ListLicensingRequest = {
  organizationId: OrganizationId;
  page: number;
  pageSize: number;
};

export type ListLicensingPageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListLicensingSubscriptionsUseCase {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async execute(
    input: ListLicensingRequest,
  ): Promise<ListLicensingPageResult<SubscriptionRecord>> {
    const page = await this.repository.listSubscriptions(input.organizationId, {
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      items: page.items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}

export class ListLicensingPaymentsUseCase {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async execute(
    input: ListLicensingRequest,
  ): Promise<ListLicensingPageResult<SoftwarePaymentRecord>> {
    const page = await this.repository.listPayments(input.organizationId, {
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      items: page.items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}

export type GetLatestSubscriptionRequest = {
  organizationId: OrganizationId;
};

export class GetLatestSubscriptionUseCase {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async execute(
    input: GetLatestSubscriptionRequest,
  ): Promise<SubscriptionRecord | null> {
    return this.repository.getLatestSubscription(input.organizationId);
  }
}
